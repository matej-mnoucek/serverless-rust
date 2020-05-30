const assert = require("assert");
const RustPlugin = require("../../index.js");
const path = require("path");

describe("RustPlugin", () => {
  const plugin = new RustPlugin(
    {
      version: "1.71.3",
      service: {
        custom: {
          rust: {
            cargoFlags: "--features foo",
            dockerImage: "notsoftprops/lambda-rust",
            dockerTag: "latest",
            dockerless: true,
          },
        },
        package: {},
      },
      config: {},
    },
    {}
  );

  it("registers expected lifecycle hooks", () => {
    assert.deepEqual(Object.keys(plugin.hooks), [
      "before:package:createDeploymentArtifacts",
      "before:deploy:function:packageFunction",
    ]);
  });
  it("sets sensible defaults", () => {
    const unconfigured = new RustPlugin(
      { version: "1.71.3", service: { package: {} }, config: {} },
      {}
    );
    assert.deepEqual(unconfigured.custom, {
      cargoFlags: "",
      dockerImage: "softprops/lambda-rust",
      dockerTag: "0.2.7-rust-1.43.0",
      dockerless: false,
    });
  });

  it("uses services.custom.rust for default overrides", () => {
    const configured = new RustPlugin(
      {
        version: "1.71.3",
        service: {
          custom: {
            rust: {
              cargoFlags: "--features foo",
              dockerImage: "notsoftprops/lambda-rust",
              dockerTag: "latest",
              dockerless: true,
            },
          },
          package: {},
        },
        config: {},
      },
      {}
    );
    assert.deepEqual(configured.custom, {
      cargoFlags: "--features foo",
      dockerImage: "notsoftprops/lambda-rust",
      dockerTag: "latest",
      dockerless: true,
    });
  });

  it("resolves cargoBinary from handler name", () => {
    assert.deepEqual(plugin.cargoBinary({ handler: "foo" }), {
      cargoPackage: "foo",
      binary: "foo",
    });

    assert.deepEqual(plugin.cargoBinary({ handler: "foo.bar" }), {
      cargoPackage: "foo",
      binary: "bar",
    });
  });

  it("configures expected localBuildArgs", () => {
    assert.deepEqual(
      plugin.localBuildArgs({}, "foo", "bar", "release", "linux"),
      [
        "build",
        "-p",
        "foo",
        "--release",
        "--target",
        "x86_64-unknown-linux-musl",
        "--features",
        "foo",
      ],
      "failed on linux"
    );
    assert.deepEqual(
      plugin.localBuildArgs({}, "foo", "bar", "release", "darwin"),
      [
        "build",
        "-p",
        "foo",
        "--release",
        "--target",
        "x86_64-unknown-linux-musl",
        "--features",
        "foo",
      ],
      "failed on osx"
    );
    assert.deepEqual(
      plugin.localBuildArgs({}, "foo", "bar", "release", "windows"),
      [
        "build",
        "-p",
        "foo",
        "--release",
        "--target",
        "x86_64-unknown-linux-musl",
        "--features",
        "foo",
      ],
      "failed on windows"
    );
  });

  it("configures expected localBuildEnv", () => {
    assert.deepEqual(plugin.localBuildEnv({}, "linux"), {}, "failed on linux");
    assert.deepEqual(
      plugin.localBuildEnv({}, "darwin"),
      {
        CC_x86_64_unknown_linux_musl: "rust-lld",
        RUSTFLAGS: " -Clinker=rust-lld",
        TARGET_CC: "rust-lld",
      },
      "failed on osx"
    );
    assert.deepEqual(
      plugin.localBuildEnv({}, "windows"),
      {
        CC_x86_64_unknown_linux_musl: "rust-lld",
        RUSTFLAGS: " -Clinker=rust-lld",
        TARGET_CC: "rust-lld",
      },
      "failed on windows"
    );
  });

  it("configures expected localSourceDir", () => {
    assert.equal(
      plugin.localSourceDir("dev", "linux"),
      path.join("target", "x86_64-unknown-linux-musl", "debug"),
      "failed on linux"
    );
    assert.equal(
      plugin.localSourceDir("release", "linux"),
      path.join("target", "x86_64-unknown-linux-musl", "release"),
      "failed on linux"
    );
    assert.equal(
      plugin.localSourceDir("dev", "darwin"),
      path.join("target", "x86_64-unknown-linux-musl", "debug"),
      "failed on osx"
    );
    assert.equal(
      plugin.localSourceDir("release", "darwin"),
      path.join("target", "x86_64-unknown-linux-musl", "release"),
      "failed on osx"
    );
    assert.equal(
      plugin.localSourceDir("dev", "windows"),
      path.join("target", "x86_64-unknown-linux-musl", "debug"),
      "failed on windows"
    );
    assert.equal(
      plugin.localSourceDir("release", "windows"),
      path.join("target", "x86_64-unknown-linux-musl", "release"),
      "failed on windows"
    );
  });

  it("configures expected localArtifactDir", () => {
    assert.equal(
      plugin.localArtifactDir("dev"),
      path.join("target", "lambda", "debug"),
      "failed on linux"
    );
    assert.equal(
      plugin.localArtifactDir("release"),
      path.join("target", "lambda", "release"),
      "failed on linux"
    );
  });

  it("builds locally under expected conditions", () => {
    const dockerless = new RustPlugin(
      {
        version: "1.71.3",
        service: {
          custom: {
            rust: {
              cargoFlags: "--features foo",
              dockerImage: "notsoftprops/lambda-rust",
              dockerTag: "latest",
              dockerless: true,
            },
          },
          package: {},
        },
        config: {},
      },
      {}
    );
    assert(dockerless.buildLocally({}));

    assert(dockerless.buildLocally({ rust: { dockerless: true } }));
  });

  it("configures expected dockerBuildArgs", () => {
    assert.deepEqual(
      plugin.dockerBuildArgs(
        {},
        "foo",
        "bar",
        "release",
        "source_path",
        "cargo_registry",
        "cargo_downloads",
        {}
      ),
      [
        "run",
        "--rm",
        "-t",
        "-e",
        "BIN=bar",
        "-v",
        "source_path:/code",
        "-v",
        "cargo_registry:/root/.cargo/registry",
        "-v",
        "cargo_downloads:/root/.cargo/git",
        "-e",
        "PROFILE=release",
        "-e",
        "CARGO_FLAGS=--features foo -p foo",
        "notsoftprops/lambda-rust:latest",
      ]
    );
  });
});
