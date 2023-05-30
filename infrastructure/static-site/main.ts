import { App } from "cdktf";
import { SpaWebsite } from "./stacks/spa-website";

const stacks = new App();
const commonConfig = {
  apexDomain: "onibi.co.uk",
  region: "eu-west-1",
  tfc_organisation: "grendel-consulting",
};

const staging = process.env["STAGING_AWS_ACCOUNT"];
const production = process.env["PRODUCTION_AWS_ACCOUNT"];

if (staging === undefined || production === undefined) {
  throw new Error("Missing AWS Account IDs");
}

new SpaWebsite(stacks, "staging", {
  ...commonConfig,
  ...{ subDomain: "staging-www", target: staging, restricted: false },
});
new SpaWebsite(stacks, "production", {
  ...commonConfig,
  ...{ subDomain: "www", target: production },
});

stacks.synth();
