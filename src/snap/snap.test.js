const exec = require("@actions/exec");
const Snap = require("./snap");

describe("the snap helper", () => {
  describe("the install function", () => {
    beforeEach(() => {
      jest.spyOn(exec, "exec").mockResolvedValue(true);
    });
    it("should install from channel if one was supplied", async () => {
      const snap = new Snap();
      await snap.install("charmcraft", "latest/beta");
      expect(exec.exec).toHaveBeenCalledWith("sudo", [
        "snap",
        "install",
        "charmcraft",
        "--classic",
        "--channel",
        "latest/beta",
      ]);
    });
    it("should not specify a channel if none was supplied", async () => {
      const snap = new Snap();
      await snap.install("charmcraft");
      expect(exec.exec).toHaveBeenCalledWith("sudo", [
        "snap",
        "install",
        "charmcraft",
        "--classic",
      ]);
    });
  });
});
