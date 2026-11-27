import {
  branchAliases,
  branchSettingsId,
  requestBranch,
  sameBranch,
} from "@/lib/branches";
import { readBranchSettings, readStoreBankSettings } from "@/lib/branch-settings";
import { photoStorageReady, uploadPhoto } from "@/lib/storage/photos";
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { readStore } from "@/lib/store";
import { db, firebaseReady } from "@/lib/firebase/admin";
import {
  ApiError,
  identity,
  requireAdmin,
  requireManager,
  sameOrigin,
} from "@/lib/firebase/access";
import { defaultStore } from "@/lib/defaults";
import { calculateOrderPrice } from "@/lib/pricing";
import { defaultSpeed, normalizeServices, serviceAllowsSpeed, serviceAvailableSpeeds, serviceUnitRate } from "@/lib/catalog";
import {
  orderSchema,
  customerOrderSchema,
  updateSchema,
  pricesSchema,
  promoSchema,
} from "@/lib/order-validation";
import type { Order } from "@/lib/types";
import { serverFailure } from "@/lib/server-diagnostics";
import { paymentLocked } from "@/lib/payments/policy";
import { bankDetails, manualLocked, safeManualSummary } from "@/lib/payments/manual-policy";
import { signalPaymentChange } from "@/lib/payments/service";
import { findPosMember, posMembershipPayment } from "@/lib/pos-membership";
import { prepareEarn, commitEarn } from "@/lib/loyalty";
import { eligibleMemberDiscount } from "@/lib/membership-eligibility";
import { prepareRewardIntent, commitRewardIntent, prepareRewardReservation, commitRewardReservation } from "@/lib/reward-intent";
import { publicTracking } from "@/lib/tracking-data";
import { isOrderReadyForBilling } from "@/lib/order-billing";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
function fail(e: unknown) {
  if (e instanceof ApiError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof z.ZodError)
    return NextResponse.json({ error: e.issues[0].message }, { status: 400 });
  console.error("D’Fable API failure", serverFailure(e));
  return NextResponse.json(
    { error: "Layanan sedang tidak tersedia. Coba lagi beberapa saat." },
    { status: 500 },
  );
}
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(
      await readStore(await identity(req), requestBranch(req.url)),
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (e) {
    return fail(e);
  }
}
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const branch = requestBranch(req.url);
    if (!firebaseReady())
      throw new ApiError(
        503,
        "Firebase belum dikonfigurasi. Pesanan belum bisa diterima.",
      );
    const user = await identity(req);
    const raw = await req.text();
    if (Buffer.byteLength(raw) > (user ? 1700000 : 8192))
      throw new ApiError(413, "Data terlalu besar.");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "Data tidak valid.");
    }
    const simpleCustomer = body.action === "order" && body.data?.source === "web" && body.data?.fulfillment !== undefined;
    if (!user && !simpleCustomer) throw new ApiError(401, "Silakan masuk terlebih dahulu.");
    const database = db();
    let id = "";
    if (body.action === "order") {
      const customerInput = simpleCustomer ? customerOrderSchema.parse(body.data) : null;
      const input = customerInput ? {
        ...customerInput,
        kg: 1,
        express: customerInput.speed !== "regular",
        address: customerInput.fulfillment === "delivery" ? customerInput.address! : "Antar dan ambil sendiri",
        lat: customerInput.fulfillment === "delivery" ? customerInput.lat! : 0,
        lng: customerInput.fulfillment === "delivery" ? customerInput.lng! : 0,
        date: "", slot: "", photo: "", insurance: false,
        posPayment: undefined, posUseMembershipBalance: undefined, posMembershipReference: undefined,
        expectedTotal: undefined, expectedMembershipAmount: undefined,
      } : orderSchema.parse(body.data);
      if (!user && (input.usePoints || input.useMembershipBalance))
        throw new ApiError(401, "Masuk untuk menggunakan poin atau saldo membership.");
      if (!simpleCustomer && ((input.usePoints && input.pointsLimit === undefined) ||
          (input.useMembershipBalance && input.membershipLimit === undefined))
      )
        throw new ApiError(409, "Muat ulang halaman dan periksa kembali pilihan poin dan saldo.");
      if (input.source === "pos") requireAdmin(user, branch);
      if (branch === "buzzwash" && input.insurance)
        throw new ApiError(400, "Perlindungan cucian belum tersedia di BuzzWash.");
      if (input.source === "pos" && (input.usePoints || input.useMembershipBalance))
        throw new ApiError(400, "Pilihan poin dan saldo hanya tersedia untuk pesanan pelanggan.");
      if (branch === "buzzwash" && !bankDetails(await readStoreBankSettings(database, branch), branch).configured)
        throw new ApiError(409, "Pemesanan BuzzWash belum tersedia sampai rekening toko dikonfigurasi.");
      if (
        input.source !== "pos" &&
        (input.posPayment ||
          input.expectedTotal !== undefined || input.posUseMembershipBalance !== undefined ||
          input.expectedMembershipAmount !== undefined || input.posMembershipReference !== undefined)
      )
        throw new ApiError(400, "Pilihan pembayaran kasir tidak tersedia.");
      if (input.posUseMembershipBalance && (!input.posMembershipReference || input.expectedMembershipAmount === undefined || input.expectedTotal === undefined))
        throw new ApiError(409, "Periksa kembali saldo yang akan digunakan dan sisa tagihan.");
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
      }).format(new Date());
      if (!simpleCustomer && input.date < today)
        throw new ApiError(400, "Jadwal tidak boleh di masa lalu.");
      const requester = user?.uid || `guest:${input.requestId}`;
      const requestIds = branchAliases(branch).map(
        (alias) =>
          "DF-" +
          createHash("sha256")
            .update(`${alias}:${requester}:${input.requestId}`)
            .digest("hex")
            .slice(0, 12)
            .toUpperCase(),
      );
      const priorRequests = await Promise.all(
        requestIds.map((orderId) => database.doc(`orders/${orderId}`).get()),
      );
      const priorIndex = priorRequests.findIndex((prior) => prior.exists);
      if (priorIndex >= 0) {
        const existing = priorRequests[priorIndex];
        if (
          existing.get("createdBy") !== requester ||
          !sameBranch(existing.get("branchId"), branch)
        )
          throw new ApiError(409, "Konflik nomor pesanan.");
        id = requestIds[priorIndex];
        const existingOrder = existing.data() as Order;
        return NextResponse.json({ store: await readStore(user, branch), id, ...(simpleCustomer ? { trackingToken: existingOrder.token, trackingOrder: publicTracking(existingOrder) } : {}) }, { headers: { "Cache-Control": "private, no-store" } });
      }
      id = requestIds[0];
      const ref = database.doc(`orders/${id}`);
      // Guest requests are limited by both phone and client network. Never trust
      // a caller-supplied forwarding header outside the Vercel edge.
      const ip = process.env.VERCEL === "1" ? req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() : null;
      const guestRateRefs = user ? [] : [
        database.doc(`guestOrderRates/${createHash("sha256").update(`phone:${input.phone}`).digest("hex")}`),
        database.doc(`guestOrderRates/${createHash("sha256").update(`network:${ip || "unavailable"}`).digest("hex")}`),
      ];
      let photoPath = "";
      if (input.photo) {
        if (!photoStorageReady())
          throw new ApiError(
            503,
            "Penyimpanan foto belum diaktifkan. Hapus foto atau hubungi toko.",
          );
        const bytes = Buffer.from(input.photo.split(",")[1], "base64");
        if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.length > 1100000)
          throw new ApiError(400, "Foto JPEG tidak valid.");
        photoPath = `orders/${user!.uid}/${id}.jpg`;
        await uploadPhoto(photoPath, bytes);
      }
      await database.runTransaction(async (tx) => {
        const [settings, prior, rate, bankSettings, ...guestRates] = await Promise.all([
          readBranchSettings(database, branch, tx),
          tx.get(ref),
          user ? tx.get(database.doc(`rateLimits/${user.uid}`)) : Promise.resolve(null),
          branch === "buzzwash" ? readStoreBankSettings(database, branch, tx) : Promise.resolve(null),
          ...guestRateRefs.map((rateRef) => tx.get(rateRef)),
        ]);
        if (prior.exists) {
          if (prior.get("createdBy") !== requester || !sameBranch(prior.get("branchId"), branch))
            throw new ApiError(409, "Konflik nomor pesanan.");
          return;
        }
        if (branch === "buzzwash" && !bankDetails(bankSettings, branch).configured)
          throw new ApiError(409, "Rekening BuzzWash belum tersedia. Coba lagi nanti.");
        const cutoff = Date.now() - 3600000;
        const attempts = (rate?.get("orders") || []).filter(
          (t: number) => t > cutoff,
        );
        if (user && attempts.length >= (user.admin ? 120 : 10))
          throw new ApiError(429, "Terlalu banyak pesanan. Coba lagi nanti.");
        const guestAttempts = guestRates.map((snapshot) => (snapshot!.get("orders") || []).filter((t: number) => Number.isFinite(t) && t > cutoff));
        if (guestAttempts.some((entries, index) => entries.length >= (index === 0 ? 10 : 40)))
          throw new ApiError(429, "Terlalu banyak pesanan. Coba lagi nanti.");
        const posMember = input.source === "pos" ? await findPosMember(database, input.phone, tx) : null;
        const customerUid = input.source === "web" ? user?.uid || null : posMember?.uid ?? null;
        const webMembership = input.source === "web" && customerUid
          ? await tx.get(database.doc(`memberships/${customerUid}`)) : null;
        const services = normalizeServices(settings.get("services"), branch);
        const service = services.find((item) => item.id === input.service);
        if (!service)
          throw new ApiError(400, "Layanan yang dipilih tidak tersedia.");
        if (simpleCustomer && service.category === "member")
          throw new ApiError(400, "Pilih layanan laundry untuk membuat pesanan.");
        const speed = input.speed || "regular";
        if (!serviceAllowsSpeed(service, speed))
          throw new ApiError(
            400,
            "Kecepatan ini tidak tersedia untuk layanan.",
          );
        const quantity = simpleCustomer ? (service.minimumQuantity || 1) : input.kg;
        if (quantity < (service.minimumQuantity || 1))
          throw new ApiError(
            400,
            `Jumlah minimum layanan ini ${service.minimumQuantity || 1} ${service.unit}.`,
          );
        if (service.maximumQuantity && quantity > service.maximumQuantity)
          throw new ApiError(400, `Maksimum layanan ini ${service.maximumQuantity} ${service.unit} per paket.`);
        if (service.unit !== "kg" && !Number.isInteger(quantity))
          throw new ApiError(400, "Jumlah item harus berupa bilangan bulat.");
        if (service.startingAt && input.source === "pos" && (input.posPayment === "cash" || input.posUseMembershipBalance))
          throw new ApiError(409, "Harga akhir perlu dikonfirmasi sebelum menerima pembayaran.");
        const unitPrice = serviceUnitRate(service, speed);
        const washService = services.find((item) => item.id === "wash")!;
        const washPrice = serviceUnitRate(washService);
        const now = new Date().toISOString();
        const {
          requestId,
          photo,
          expectedTotal,
          expectedMembershipAmount,
          posUseMembershipBalance,
          posMembershipReference,
          posPayment,
          ...cleanInput
        } = input;
        void requestId;
        void photo;
        const clean = {
          ...cleanInput,
          ...(posPayment ? { posPayment } : {}),
          kg: quantity,
          ...(simpleCustomer ? {
            fulfillment: customerInput!.fulfillment,
            quantityPending: true,
            // Points are chosen only after the store confirms the final bill.
            usePoints: false,
            pointsLimit: 0,
          } : {}),
          membershipDiscount: posMember?.discountEligible ?? eligibleMemberDiscount(webMembership?.data()),
          express: speed !== "regular",
          unit: service.unit,
          speed,
          pricingVersion: 2 as const,
          minimumQuantity: service.minimumQuantity || 1,
          ...(service.maximumQuantity ? { maximumQuantity: service.maximumQuantity } : {}),
          ...(service.pricingModel ? { pricingModel: service.pricingModel } : {}),
          ...(service.startingAt ? { startingAt: true, pricePending: true } : {}),
        };
        if (posUseMembershipBalance && !posMember?.discountEligible)
          throw new ApiError(409, "Saldo membership sudah tidak tersedia. Cek ulang nomor dan saldo pelanggan.");
        if (posUseMembershipBalance && posMembershipReference !== posMember?.reference)
          throw new ApiError(409, "Akun pelanggan berubah. Cek ulang nomor sebelum memakai saldo.");
        const serviceAmount = simpleCustomer ? 0 : calculateOrderPrice({ ...clean, unitPrice, washPrice }, quantity);
        const { total: calculatedTotal, membershipUsed } = posMembershipPayment(
          serviceAmount, input.insurance, posMember?.balance ?? 0, posUseMembershipBalance === true,
        );
        if (input.source === "pos" && (
          ((input.posPayment === "cash" || expectedTotal !== undefined) && expectedTotal !== calculatedTotal) ||
          (posUseMembershipBalance && expectedMembershipAmount !== membershipUsed)
        ))
          throw new ApiError(409, "Harga atau saldo berubah. Cek ulang tagihan sebelum menerima pembayaran.");
        const settledByBalance = membershipUsed > 0 && calculatedTotal === 0;
        const paidCash = input.source === "pos" && input.posPayment === "cash" && !settledByBalance;
        const status = input.source === "pos" ? 3 : 0;
        const token = randomUUID();
        const order: Order = {
          ...clean,
          id,
          token,
          uid: customerUid,
          branchId: branch,
          actualKg: input.source === "pos" ? input.kg : null,
          status,
          paid: paidCash || settledByBalance,
          ...(paidCash || settledByBalance
            ? { paymentMethod: settledByBalance ? "membership" as const : "cash" as const, paidAt: now }
            : {}),
          ...(membershipUsed ? { membershipUsed } : {}),
          shippingFee: input.source === "pos" || customerInput?.fulfillment === "dropoff" ? 0 : null,
          total: calculatedTotal,
          unitPrice,
          washPrice,
          photo: "",
          photoPath,
          createdAt: now,
          history: [{ status, at: now }],
        };
        const reservation = input.source === "web" && !simpleCustomer
          ? await prepareRewardReservation(tx, database, order, calculatedTotal - (input.insurance ? 1000 : 0), null, false)
          : null;
        const earn = order.paid ? await prepareEarn(tx, database, order) : null;
        if (membershipUsed && posMember) {
          const walletRef = database.doc(`memberships/${posMember.uid}`);
          const balanceAfter = posMember.balance - membershipUsed;
          tx.update(walletRef, { balance: balanceAfter, updatedAt: now });
          tx.create(walletRef.collection("events").doc(`pos-${id}`), {
            type: "redeemed", source: "pos", amount: membershipUsed, balanceAfter,
            orderId: id, branchId: branch, createdAt: now, recordedBy: requester,
          });
        }
        const earnedFields = commitEarn(tx, database, order, earn, now);
        const reservedFields = reservation ? commitRewardReservation(tx, database, order, reservation, now) : {};
        tx.create(ref, { ...order, ...earnedFields, ...reservedFields, createdBy: requester });
        // Wake the active store dashboard as soon as a customer order is committed.
        if (input.source === "web") signalPaymentChange(tx, database, branch);
        tx.create(database.doc(`tracking/${token}`), { orderId: id });
        if (user) tx.set(database.doc(`rateLimits/${user.uid}`), {
          orders: [...attempts, Date.now()], updatedAt: now,
        });
        else guestRateRefs.forEach((rateRef, index) => tx.set(rateRef, { orders: [...guestAttempts[index], Date.now()], updatedAt: now }));
        if (input.source === "web" && user)
          tx.set(
            database.doc(`users/${user.uid}`),
            {
              name: input.name,
              phone: input.phone,
              email: user.email,
              updatedAt: now,
            },
            { merge: true },
          );
        else if (input.source === "pos")
          tx.set(
            database.doc(
              `walkInCustomers/${createHash("sha256").update(input.phone).digest("hex")}`,
            ),
            { name: input.name, phone: input.phone, updatedAt: now },
            { merge: true },
          );
      });
      if (simpleCustomer) {
        const stored = await ref.get();
        if (stored.get("createdBy") !== requester) throw new ApiError(409, "Konflik nomor pesanan.");
        const storedOrder = stored.data() as Order;
        return NextResponse.json({ store: await readStore(user, branch), id, trackingToken: storedOrder.token, trackingOrder: publicTracking(storedOrder) }, { headers: { "Cache-Control": "private, no-store" } });
      }
    } else if (body.action === "update") {
      requireAdmin(user, branch);
      const v = updateSchema.parse(body.data);
      await database.runTransaction(async (tx) => {
        const ref = database.doc(`orders/${v.id}`);
        const snap = await tx.get(ref);
        if (!snap.exists) throw new ApiError(404, "Pesanan tidak ditemukan.");
        const o = snap.data() as Order;
        if (!sameBranch(o.branchId, branch))
          throw new ApiError(
            409,
            "Pesanan berada di toko lain. Buka workspace yang sesuai.",
          );
        if (v.status < o.status)
          throw new ApiError(400, "Status tidak boleh mundur.");
        if (o.fulfillment === "dropoff" && [1, 2, 6].includes(v.status))
          throw new ApiError(400, "Status penjemputan dan pengantaran tidak berlaku untuk antar dan ambil sendiri.");
        if (v.paid && v.shippingFee === null)
          throw new ApiError(400, "Konfirmasi ongkir sebelum menandai lunas.");
        if (v.actualKg === null) {
          if (!o.quantityPending || o.actualKg !== null)
            throw new ApiError(400, "Jumlah aktual tidak boleh dikosongkan setelah ditimbang.");
          if (v.status >= 3)
            throw new ApiError(400, "Isi jumlah cucian terlebih dahulu untuk melanjutkan ke tahap ditimbang.");
          if (v.confirmedUnitPrice !== undefined)
            throw new ApiError(400, "Tentukan jumlah cucian sebelum menyimpan harga akhir.");
          if (v.paid !== o.paid || ((o.paid || o.paymentReconciliationRequired || paymentLocked(o.payment) || manualLocked(o.manualPayment)) && v.shippingFee !== o.shippingFee))
            throw new ApiError(409, "Tagihan terkunci selama pembayaran sedang diperiksa atau sudah lunas.");
          const now = new Date().toISOString();
          const history = [...o.history];
          if (v.status !== o.status) history.push({ status: v.status, at: now });
          tx.update(ref, { status: v.status, shippingFee: v.shippingFee, history,
            paymentRevision: (o.paymentRevision || 0) + 1, updatedBy: user!.uid, updatedAt: now });
          if (v.shippingFee !== o.shippingFee || v.status !== o.status)
            signalPaymentChange(tx, database, o.branchId);
          return;
        }
        if (o.unit && o.unit !== "kg" && !Number.isInteger(v.actualKg))
          throw new ApiError(400, "Jumlah aktual item harus bilangan bulat.");
        if (o.maximumQuantity && v.actualKg > o.maximumQuantity)
          throw new ApiError(400, `Maksimum layanan ini ${o.maximumQuantity} ${o.unit || "kg"} per paket.`);
        if (v.confirmedUnitPrice !== undefined && (!o.startingAt || !o.pricePending))
          throw new ApiError(400, "Harga layanan ini tidak menunggu konfirmasi.");
        if (v.confirmedUnitPrice !== undefined && v.confirmedUnitPrice < o.unitPrice)
          throw new ApiError(400, "Harga akhir tidak boleh kurang dari harga mulai.");
        const updatedUnitPrice = v.confirmedUnitPrice ?? o.unitPrice;
        if (!o.rewardsReservedAt && (o.membershipUsed || 0) > 0 && v.actualKg !== o.actualKg)
          throw new ApiError(
            409,
            "Jumlah tidak dapat diubah setelah saldo membership digunakan.",
          );
        const serviceTotal = calculateOrderPrice({ ...o, unitPrice: updatedUnitPrice }, v.actualKg);
        if (!o.rewardsReservedAt && (o.pointsUsed || 0) + (o.membershipUsed || 0) > serviceTotal)
          throw new ApiError(
            409,
            "Poin dan saldo membership yang digunakan melebihi harga layanan. Minta pelanggan mengurangi penggunaannya terlebih dahulu.",
          );
        const total =
          serviceTotal -
          (o.pointsUsed || 0) -
          (o.membershipUsed || 0) +
          (o.insurance ? 1000 : 0) +
          (v.shippingFee ?? 0);
        if (v.paid !== o.paid)
          throw new ApiError(
            409,
            "Periksa bukti transfer melalui menu pembayaran untuk mengonfirmasi tagihan. Status lunas tidak dapat diubah dari form pesanan.",
          );
        if (
          (paymentLocked(o.payment) ||
            manualLocked(o.manualPayment) ||
            o.paid ||
            o.paymentReconciliationRequired) &&
          (updatedUnitPrice !== o.unitPrice || total !== o.total ||
            v.actualKg !== o.actualKg ||
            v.shippingFee !== o.shippingFee)
        )
          throw new ApiError(
            409,
            "Tagihan terkunci selama pembayaran sedang diperiksa atau sudah lunas. Periksa pembayaran terlebih dahulu.",
          );
        if (o.paid && v.paid && total !== o.total)
          throw new ApiError(
            400,
            "Batalkan tanda lunas sebelum mengubah tagihan.",
          );
        const confirmedOrder = {
          ...o,
          status: v.status,
          actualKg: v.actualKg,
          shippingFee: v.shippingFee,
          quantityPending: false,
          pricePending: o.pricePending && v.confirmedUnitPrice === undefined,
        };
        const billingReady = isOrderReadyForBilling(confirmedOrder);
        const needsRewards = !!o.uid && !o.rewardsReservedAt && !o.rewardsAppliedAt &&
          !!(o.usePoints || o.useMembershipBalance) && billingReady;
        if (needsRewards && (o.paid || o.paymentReconciliationRequired || paymentLocked(o.payment) || manualLocked(o.manualPayment)))
          throw new ApiError(409, "Poin dan saldo tidak dapat diterapkan selama pembayaran sedang diproses.");
        const rewards = needsRewards
          ? await prepareRewardIntent(tx, database, confirmedOrder, serviceTotal, v.shippingFee!)
          : null;
        const reservation = o.rewardsReservedAt && !o.paid &&
          !o.paymentReconciliationRequired && !paymentLocked(o.payment) && !manualLocked(o.manualPayment)
          ? await prepareRewardReservation(
              tx, database, o, serviceTotal, v.shippingFee,
              !o.pricePending || v.confirmedUnitPrice !== undefined,
            )
          : null;
        if (!rewards && !reservation && total === 0 && !o.paid)
          throw new ApiError(409, "Minta pelanggan mengurangi poin sebelum mengubah jumlah atau ongkir ini.");
        const history = [...o.history];
        if (v.status !== o.status)
          history.push({ status: v.status, at: new Date().toISOString() });
        const now = new Date().toISOString();
        const rewardFields = rewards ? commitRewardIntent(tx, database, o, rewards, now)
          : reservation ? commitRewardReservation(tx, database, o, reservation, now) : {};
        tx.update(ref, {
          status: v.status,
          actualKg: v.actualKg,
          ...(o.quantityPending ? { quantityPending: false } : {}),
          shippingFee: v.shippingFee,
          ...(v.confirmedUnitPrice !== undefined ? { unitPrice: updatedUnitPrice, pricePending: false } : {}),
          paid: v.paid,
          total,
          ...rewardFields,
          ...((rewards || reservation) && o.manualPayment?.hasProof &&
              ((rewards?.total ?? reservation?.total ?? total) !== o.total || v.actualKg !== o.actualKg || v.shippingFee !== o.shippingFee)
            ? { manualPayment: safeManualSummary({
                method: "bank_transfer", status: "unpaid", amount: null, hasProof: false,
                ...(o.manualPayment.bank ? { bank: o.manualPayment.bank } : {}),
              }) }
            : {}),
          history,
          paymentRevision: (o.paymentRevision || 0) + 1,
          updatedBy: user!.uid,
          updatedAt: now,
        });
        if (
          total !== o.total ||
          updatedUnitPrice !== o.unitPrice ||
          v.actualKg !== o.actualKg ||
          v.shippingFee !== o.shippingFee ||
          v.paid !== o.paid || v.status !== o.status || rewards !== null || reservation !== null ||
          billingReady !== isOrderReadyForBilling(o)
        )
          signalPaymentChange(tx, database, o.branchId);
      });
    } else if (body.action === "prices") {
      requireManager(user, branch);
      const prices = pricesSchema.parse(body.data);
      await database.runTransaction(async (tx) => {
        const ref = database.doc(`settings/${branchSettingsId(branch)}`);
        const snap = await readBranchSettings(database, branch, tx);
        const settings = { ...defaultStore, ...snap.data() };
        const currentServices = normalizeServices(settings.services, branch);
        if (
          prices.length !== currentServices.length ||
          currentServices.some(
            (service) =>
              prices.some((price) => price.id === service.id) === false,
          )
        )
          throw new ApiError(400, "Daftar layanan harus lengkap.");
        const services = currentServices.map((service) => {
          const update = prices.find((price) => price.id === service.id)!;
          if (service.rates && !update.rates)
            throw new ApiError(
              400,
              `Tarif kecepatan ${service.name} belum lengkap.`,
            );
          if (!service.rates && update.rates)
            throw new ApiError(
              400,
              `Tarif kecepatan ${service.name} tidak digunakan.`,
            );
          const rates = service.rates ? update.rates! : undefined;
          if (rates && serviceAvailableSpeeds(service).some((speed) => rates[speed] === undefined))
            throw new ApiError(400, `Tarif kecepatan ${service.name} belum lengkap.`);
          if (rates && Object.keys(rates).some((speed) => !serviceAvailableSpeeds(service).includes(speed as keyof typeof rates)))
            throw new ApiError(400, `Kecepatan yang dipilih tidak tersedia untuk ${service.name}.`);
          return {
            ...service,
            price: rates?.[defaultSpeed(service)] ?? update.price,
            ...(rates ? { rates } : {}),
          };
        });
        tx.set(
          ref,
          { services, promo: settings.promo, updatedBy: user!.uid },
          { merge: true },
        );
      });
    } else if (body.action === "promo") {
      requireManager(user, branch);
      const promo = promoSchema.parse(body.data);
      await database.runTransaction(async (tx) => {
        const ref = database.doc(`settings/${branchSettingsId(branch)}`);
        const snap = await readBranchSettings(database, branch, tx);
        tx.set(
          ref,
          {
            services: normalizeServices(snap.get("services"), branch),
            promo,
            updatedBy: user!.uid,
          },
          { merge: true },
        );
      });
    } else throw new ApiError(400, "Aksi tidak dikenal.");
    return NextResponse.json({ store: await readStore(user, branch), id });
  } catch (e) {
    return fail(e);
  }
}
