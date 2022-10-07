import { Construct } from "constructs";
import { App, TerraformOutput, TerraformStack } from "cdktf";

import { GoogleProvider } from "@cdktf/provider-google/lib/provider";
import { ComputeNetwork } from "@cdktf/provider-google/lib/compute-network";
import { ComputeSubnetwork } from "@cdktf/provider-google/lib/compute-subnetwork";
import { RandomProvider } from "@cdktf/provider-random/lib/provider";
import { Id } from "@cdktf/provider-random/lib/id";
import { ComputeAddress } from "@cdktf/provider-google/lib/compute-address";
import { ComputeInstance } from "@cdktf/provider-google/lib/compute-instance";
import { ComputeFirewall } from "@cdktf/provider-google/lib/compute-firewall";

class MyStack extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);
    new RandomProvider(this, "random", {});
    new GoogleProvider(this, "provider", {
      project: "redbelly",
      region: "australia-southeast1",
      zone: "australia-southeast1-a"
    });

    const id = new Id(this, "randomId", {
      byteLength: 4
    })

    const vpc = new ComputeNetwork(this, "vpc", {
      name: concat("isolated-vpc", id.hex),
      autoCreateSubnetworks: false,
      mtu: 1460
    })

    const subnet = new ComputeSubnetwork(this, "aus-subnet", {
      name: concat("aus-subnet", id.hex),
      ipCidrRange: "10.152.0.0/20",
      network: vpc.name
    })

    const staticIp = new ComputeAddress(this, "staticIp", {
      name: concat("isolated", id.hex),
    })

    new ComputeFirewall(this, "rbn-firewall", {
      name : concat("rbn-firewall", id.hex),
      network : vpc.name,
      allow: [{
        protocol : "tcp",
        ports : ["22"]

      }],
      sourceRanges : ["0.0.0.0/0"],
      targetTags : ["rbn"]
    })

    new ComputeInstance(this, "vm", {
      name: concat("isolatedvm", id.hex),
      machineType: "e2-small",
      bootDisk: {
        initializeParams: {
          image: "ubuntu-os-cloud/ubuntu-2204-lts"
        }
      },
      tags: ["rbn"],
      networkInterface: [{
        network: vpc.name,
        subnetwork: subnet.name,
        accessConfig : [{
          natIp : staticIp.address
        }]
      }],

    })

    new TerraformOutput(this, "vmip", {
      value : staticIp.address
    })
  }


}

function concat(id: string, randomKey: string): string {
  return id + "-" + randomKey
}

const app = new App();
new MyStack(app, "isolated-vm");
app.synth();
