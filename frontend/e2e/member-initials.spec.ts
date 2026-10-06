import { test, expect } from "@playwright/test";
import { memberInitials, memberDisplayName } from "../src/features/squads/initials";

test("real-name initials handle multiple tokens, Turkish casing, graphemes and missing data", () => {
  for (const [firstName, lastName, initials] of [["Alper", "Temiz", "A.T"], ["Nisa", "Camcı", "N.C"], ["Kerem", "Kaya", "K.K"], ["Hamza", "Temiz", "H.T"], ["Mehmet Ali", "Yılmaz", "M.Y"], [" İpek ", " Çelik ", "İ.Ç"]]) {
    expect(memberInitials({ firstName, lastName }, "tr")).toBe(initials);
  }
  expect(memberInitials({ firstName: "Alper" }, "tr")).toBe("A");
  expect(memberInitials({ nickname: "sample_user" }, "en")).toBe("S");
  expect(memberInitials({}, "en")).toBe("?");
  expect(memberInitials({ firstName: "E\u0301mile", lastName: "Zola" }, "en")).toBe("E\u0301.Z");
  expect(memberDisplayName({ firstName: "Alper", lastName: "Temiz" })).toBe("Alper Temiz");
  expect(memberDisplayName({ nickname: "unchanged_nickname" })).toBe("unchanged_nickname");
});
