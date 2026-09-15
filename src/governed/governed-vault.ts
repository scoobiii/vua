/**
 * @gos3-contract
 * @version 1.0.0
 * @resource /src/governed/governed-vault.ts
 * @checksum sha256:24809582b25160572ce1d140cd09fb5a0bafad2005258ba41414e02737de48b5
 * @capability repository.write
 * @onboarded_at 2026-09-08T09:48:00.000Z
 * @governed true
 */

export interface GovernedVaultItem {
  id: string;
  name: string;
  secretReference: string;
  lastAudited: string;
}

export const GOVERNED_ITEMS: GovernedVaultItem[] = [
  {
    id: 'vault-001',
    name: 'Production Deploy Key',
    secretReference: 'vault:prod-key-ed25519',
    lastAudited: '2026-09-08T09:00:00.000Z',
  },
];
