import test from "node:test";
import assert from "node:assert/strict";
import { customerContextPaths, customerTenantContext } from "../lib/customer-context";

test("shared account pages keep explicit store context in navigation", () => {
  assert.equal(customerTenantContext("?branch=cinere"), "dfablelaundry");
  const dfable = customerContextPaths(customerTenantContext("?branch=dfablelaundry"));
  assert.equal(dfable.home, "/dfabel");
  assert.equal(dfable.profile, "/profil?branch=dfablelaundry");
  assert.equal(dfable.about, "/tentang?branch=dfablelaundry");
  assert.equal(dfable.view("tracking"), "/dfabel?view=tracking");
  assert.equal(dfable.login, "/dfabel?account=1");
  const buzz = customerContextPaths(customerTenantContext("?branch=buzzwash"));
  assert.equal(buzz.view("services"), "/buzzwash?view=services");
  assert.equal(buzz.profile, "/profil?branch=buzzwash");
});

test("missing or unknown branch keeps platform links", () => {
  for (const search of ["", "?branch=unknown", "?branch=https%3A%2F%2Fevil.test"]) {
    const paths = customerContextPaths(customerTenantContext(search));
    assert.equal(paths.home, "/");
    assert.equal(paths.profile, "/profil");
    assert.equal(paths.about, "/tentang");
  }
});
