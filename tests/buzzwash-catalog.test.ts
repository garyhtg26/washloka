import test from "node:test";
import assert from "node:assert/strict";
import {
  catalogForBranch,
  defaultSpeed,
  normalizeServices,
  serviceAllowsSpeed,
  serviceAvailableSpeeds,
  serviceRate,
  serviceTotal,
} from "../lib/catalog";

const buzz = catalogForBranch("buzzwash");
const item = (id: string) => {
  const found = buzz.find((service) => service.id === id);
  assert.ok(found, `Missing BuzzWash service ${id}`);
  return found;
};

test("BuzzWash kiloan and the fixed-price 10 kg package match its poster", () => {
  const wash = item("wash");
  assert.equal(wash.pricingModel, "flat-package");
  assert.equal(wash.maximumQuantity, 10);
  assert.deepEqual(serviceAvailableSpeeds(wash), ["oneDay", "express"]);
  assert.equal(serviceAllowsSpeed(wash, "regular"), false);
  assert.equal(defaultSpeed(wash), "oneDay");
  assert.equal(serviceTotal(wash, 3, "oneDay"), 35000);
  assert.equal(serviceTotal(wash, 10, "oneDay"), 35000);
  assert.equal(serviceTotal(wash, 3, "express"), 45000);
  assert.equal(serviceTotal(item("complete"), 3, "regular"), 24000);
  assert.deepEqual(item("complete").rates, { regular: 8000, oneDay: 10000, express: 13000, quick: 16000 });
  assert.deepEqual(item("iron").rates, { regular: 7000, oneDay: 9000, express: 12000, quick: 15000 });
  assert.equal(item("complete").minimumQuantity, 3);
  assert.equal(item("iron").minimumQuantity, 3);
});

test("every BuzzWash satuan item has its published One Day and Express price", () => {
  const prices: Record<string, number> = {
    tops:15000, bottoms:15000, batik:25000, "alat-ibadah":10000,
    "baju-muslim":20000, suits:25000, jacket:20000, cardigan:20000,
    setelan:25000, dress:20000, gown:45000, coat:40000,
    "bed-cover-single":25000, "bed-cover-double":35000, pillowcase:5000,
    blanket:15000, "bed-sheet":15000, "sleeping-bag":20000,
    tablecloth:10000, towel:10000, mattress:25000, "sprei-set":25000,
  };
  for (const [id, price] of Object.entries(prices)) {
    const service = item(id);
    assert.deepEqual(serviceAvailableSpeeds(service), ["oneDay", "express"]);
    assert.equal(serviceRate(service, "oneDay"), price, id);
    assert.equal(serviceRate(service, "express"), price + 10000, id);
    assert.equal(serviceAllowsSpeed(service, "quick"), false, id);
  }
});

test("premium starting prices and unpublished turnaround are represented honestly", () => {
  const prices: Array<[string, number, boolean]> = [
    ["sepatu",50000,false], ["karpet-kecil",35000,true], ["karpet-sedang",50000,true],
    ["karpet-besar",75000,true], ["boneka-sedang",35000,false],
    ["boneka-besar",50000,true], ["tas-sekolah",40000,false],
  ];
  for (const [id, price, startingAt] of prices) {
    const service = item(id);
    assert.equal(service.price, price);
    assert.equal(service.startingAt, startingAt);
    assert.deepEqual(serviceAvailableSpeeds(service), []);
    assert.equal(service.days, "Dikonfirmasi toko");
  }
});

test("catalog defaults do not leak between D'Fable and BuzzWash", () => {
  const dfable = catalogForBranch("dfablelaundry");
  assert.equal(dfable.find((service) => service.id === "iron")?.price, 5000);
  assert.equal(item("iron").price, 7000);
  assert.equal(item("wash").price, 35000);
  assert.equal(buzz.some((service) => service.id === "member"), false);
  assert.deepEqual(normalizeServices(dfable, "buzzwash"), buzz);
});
