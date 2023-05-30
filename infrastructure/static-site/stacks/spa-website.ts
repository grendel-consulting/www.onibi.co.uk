import {
  CloudBackend,
  NamedCloudWorkspace,
  TerraformStack,
  TerraformOutput,
} from "cdktf";
import { AwsProvider } from "@cdktf/provider-aws/lib/provider";
import { DataAwsRoute53Zone } from "@cdktf/provider-aws/lib/data-aws-route53-zone";
import { DataAwsIamPolicyDocument } from "@cdktf/provider-aws/lib/data-aws-iam-policy-document";
import { Route53Record } from "@cdktf/provider-aws/lib/route53-record";
import { AcmCertificate } from "@cdktf/provider-aws/lib/acm-certificate";
import { AcmCertificateValidation } from "@cdktf/provider-aws/lib/acm-certificate-validation";
import { S3Bucket } from "@cdktf/provider-aws/lib/s3-bucket";
import { S3BucketVersioningA } from "@cdktf/provider-aws/lib/s3-bucket-versioning";
import { S3BucketPolicy } from "@cdktf/provider-aws/lib/s3-bucket-policy";
import { CloudfrontDistribution } from "@cdktf/provider-aws/lib/cloudfront-distribution";
import { CloudfrontOriginAccessIdentity } from "@cdktf/provider-aws/lib/cloudfront-origin-access-identity";
import { CloudfrontResponseHeadersPolicy } from "@cdktf/provider-aws/lib/cloudfront-response-headers-policy";
import { CloudfrontCachePolicy } from "@cdktf/provider-aws/lib/cloudfront-cache-policy";
import { Construct } from "constructs";
import { z } from "zod";

const SpaWebsiteConfig = z.object({
  apexDomain: z.string(),
  subDomain: z.string(),
  tfc_organisation: z.string(),
  region: z.string(),
  target: z.string(),
  restricted: z.boolean().optional(),
});

export type SpaWebsiteConfigType = z.infer<typeof SpaWebsiteConfig>;

export class SpaWebsite extends TerraformStack {
  constructor(scope: Construct, ns: string, config?: SpaWebsiteConfigType) {
    super(scope, ns);

    const props = SpaWebsiteConfig.parse(config ?? {});
    const targetDomain = `${props.subDomain}.${props.apexDomain}`;
    const targetWorkspace = targetDomain.replaceAll(".", "-");

    const originId = `s3-${targetDomain}`;
    const reportingEndpoint = "https://hrothgar.uriports.com/reports";

    const isRestricted = props.restricted ?? false;

    new CloudBackend(this, {
      hostname: "app.terraform.io",
      organization: props.tfc_organisation,
      workspaces: new NamedCloudWorkspace(targetWorkspace),
    });

    // Default provider is in the target AWS Account
    new AwsProvider(this, "aws", {
      region: props.region,
      assumeRole: [
        {
          roleArn: `arn:aws:iam::${props.target}:role/tfc-role`,
        },
      ],
    });

    const cloudfrontProvider = new AwsProvider(this, "aws.cloudfront", {
      region: "us-east-1",
      alias: "cloudfront",
      assumeRole: [
        {
          roleArn: `arn:aws:iam::${props.target}:role/tfc-role`,
        },
      ],
    });

    const controlPlaneProvider = new AwsProvider(this, "aws.controlplane", {
      alias: "controlplane",
      region: props.region,
    });

    const existingZone = new DataAwsRoute53Zone(this, "existing", {
      provider: controlPlaneProvider,
      name: props.apexDomain,
    });

    const certificate = new AcmCertificate(this, "certificate", {
      provider: cloudfrontProvider,
      domainName: targetDomain,
      subjectAlternativeNames: [props.apexDomain],
      validationMethod: "DNS",
    });

    const validation_records = new Route53Record(this, "validation_records", {
      provider: controlPlaneProvider,
      zoneId: existingZone.zoneId,
      name: "${each.value.name}",
      type: "${each.value.type}",
      records: ["${each.value.record}"],
      ttl: 60,
      allowOverwrite: true,
    });

    validation_records.addOverride(
      "for_each",
      `\${{
      for dvo in aws_acm_certificate.${certificate.friendlyUniqueId}.domain_validation_options : dvo.domain_name => {
        name   = dvo.resource_record_name
        record = dvo.resource_record_value
        type   = dvo.resource_record_type
      }
      }}`
    );

    const validation = new AcmCertificateValidation(this, "validation", {
      provider: cloudfrontProvider,
      certificateArn: certificate.arn,
    });

    validation.addOverride(
      "validation_record_fqdns",
      `\${[for record in aws_route53_record.${validation_records.friendlyUniqueId} : record.fqdn]}`
    );

    const cloudfrontOai = new CloudfrontOriginAccessIdentity(this, "oai", {
      comment: `CloudFront OAI for ${targetDomain}`,
    });

    const bucket = new S3Bucket(this, "website", {
      bucket: targetDomain,
    });

    new S3BucketVersioningA(this, "versioning", {
      bucket: bucket.id,
      versioningConfiguration: {
        status: "Enabled",
      },
    });

    const policyForOai = new DataAwsIamPolicyDocument(this, "oai_policy", {
      statement: [
        {
          actions: ["s3:GetObject"],
          resources: [`${bucket.arn}/*`],
          principals: [
            {
              type: "CanonicalUser",
              identifiers: [cloudfrontOai.s3CanonicalUserId],
            },
          ],
        },
      ],
    });

    new S3BucketPolicy(this, "oai_on_bucket", {
      bucket: bucket.id,
      policy: policyForOai.json,
    });

    const cachePolicy = new CloudfrontCachePolicy(this, "cache_policy", {
      name: `${targetWorkspace}-cache-policy`,
      parametersInCacheKeyAndForwardedToOrigin: {
        cookiesConfig: {
          cookieBehavior: "none",
        },
        headersConfig: {
          headerBehavior: "none",
        },
        queryStringsConfig: {
          queryStringBehavior: "none",
        },
      },
      minTtl: 0,
      defaultTtl: 86400,
      maxTtl: 31536000,
    });

    const policy = [
      "base-uri 'self'",
      "default-src 'none'",
      "script-src 'self' 'unsafe-inline' https:",
      "require-trusted-types-for 'script'",
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "worker-src 'self'",
      "prefetch-src 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "frame-src https:",
      "media-src https:",
      "upgrade-insecure-requests",
      "block-all-mixed-content",
      "manifest-src 'self'",
      `report-uri ${reportingEndpoint}/report`,
      "report-to default",
    ];

    const responseHeaders = new CloudfrontResponseHeadersPolicy(
      this,
      "response_headers",
      {
        name: `${targetWorkspace}-security-headers`,
        securityHeadersConfig: {
          contentSecurityPolicy: {
            contentSecurityPolicy: policy.join("; "),
            override: true,
          },
          contentTypeOptions: {
            override: true,
          },
          frameOptions: {
            frameOption: "SAMEORIGIN",
            override: true,
          },
          referrerPolicy: {
            referrerPolicy: "same-origin",
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAgeSec: 31536000,
            includeSubdomains: true,
            override: true,
          },
          xssProtection: {
            modeBlock: true,
            protection: true,
            override: true,
          },
        },
        customHeadersConfig: {
          items: [
            {
              header: "Report-To",
              value: `{'group':'default','max_age':10886400,'endpoints':[{'url':'${reportingEndpoint}'}],'include_subdomains':true}`,
              override: true,
            },
            {
              header: "Reporting-Endpoints",
              value: `default='${reportingEndpoint}'`,
              override: true,
            },
            {
              header: "NEL",
              value:
                "{'report_to':'default','max_age':2592000,'include_subdomains':true,'failure_fraction':1.0}",
              override: true,
            },
            {
              header: "Permissions-Policy-Report-Only",
              value: "fullscreen=(self)",
              override: true,
            },
            {
              header: "Cross-Origin-Embedder-Policy-Report-Only",
              value: "require-corp; report-to='default'",
              override: true,
            },
            {
              header: "Cross-Origin-Opener-Policy-Report-Only",
              value: "same-origin; report-to='default'",
              override: true,
            },
          ],
        },
      }
    );

    const distribution = new CloudfrontDistribution(this, "distribution", {
      aliases: [targetDomain],
      defaultRootObject: "index.html",

      isIpv6Enabled: true,
      enabled: true,
      httpVersion: "http2and3",

      viewerCertificate: {
        acmCertificateArn: certificate.arn,
        minimumProtocolVersion: "TLSv1.2_2019",
        sslSupportMethod: "sni-only",
      },

      restrictions: {
        geoRestriction: {
          restrictionType: isRestricted ? "whitelist" : "none",
          locations: isRestricted ? ["GB"] : [],
        },
      },

      origin: [
        {
          domainName: bucket.bucketRegionalDomainName,
          originId,
          s3OriginConfig: {
            originAccessIdentity: cloudfrontOai.cloudfrontAccessIdentityPath,
          },
        },
      ],

      defaultCacheBehavior: {
        allowedMethods: ["GET", "HEAD", "OPTIONS"],
        cachedMethods: ["GET", "HEAD"],
        targetOriginId: originId,
        viewerProtocolPolicy: "redirect-to-https",
        cachePolicyId: cachePolicy.id,
        responseHeadersPolicyId: responseHeaders.id,
        compress: true,
      },

      tags: {
        Name: targetDomain,
      },
    });

    new Route53Record(this, "subdomain", {
      provider: controlPlaneProvider,
      zoneId: existingZone.zoneId,
      name: targetDomain,
      type: "A",
      alias: {
        name: distribution.domainName,
        zoneId: distribution.hostedZoneId,
        evaluateTargetHealth: false,
      },
    });

    new Route53Record(this, "apex", {
      provider: controlPlaneProvider,
      zoneId: existingZone.zoneId,
      name: props.apexDomain,
      type: "A",
      alias: {
        name: distribution.domainName,
        zoneId: distribution.hostedZoneId,
        evaluateTargetHealth: false,
      },
    });

    new TerraformOutput(this, "cname", {
      value: targetDomain,
    });

    new TerraformOutput(this, "bucket", {
      value: bucket.bucket,
    });

    new TerraformOutput(this, "cloudfont_distribution", {
      value: distribution.id,
    });

    new TerraformOutput(this, "cloudfront_domain_name", {
      value: distribution.domainName,
    });
  }
}
