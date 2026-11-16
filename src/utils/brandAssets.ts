/**
 * ============================================================================
 * OFFICIAL KUK BRAND IDENTITY SYSTEM (v3.1.0)
 * Primary Reference: Rebranding KUK.pdf
 * ============================================================================
 */

export const KUK_BRAND_COLORS = {
  white: '#FFFFFF',
  lightGrey: '#E5E5E5',
  gold: '#FFCC00',
  darkGold: '#996414',
  red: '#FF0000',
  deepMaroon: '#540000',
  deepMaroonDark: '#3B0000',
  surfaceBg: '#F8F9FA',
} as const;

export interface BrandUnitInfo {
  unitCode: string;
  name: string;
  subtitle: string;
  logoHorizontal: string;
  logoVertical: string;
  logoEmblem: string;
  badgeLabel: string;
}

export function getUnitBrandInfo(unitOrName?: string | { code?: string; name?: string } | null, isPusat = false): BrandUnitInfo {
  if (isPusat || !unitOrName) {
    return {
      unitCode: 'PUSAT',
      name: 'KUK Management System',
      subtitle: 'Kantor Pusat Operasional',
      logoHorizontal: '/brand/logos/kul-horizontal.png',
      logoVertical: '/brand/logos/kul-vertical.png',
      logoEmblem: '/brand/logos/kul-emblem.png',
      badgeLabel: 'PUSAT',
    };
  }

  const raw = typeof unitOrName === 'string' ? unitOrName : (unitOrName.code || unitOrName.name || '');
  const lower = raw.toLowerCase();

  if (lower.includes('palen')) {
    return {
      unitCode: 'KUK-PALEN',
      name: 'KUK Palen',
      subtitle: 'Retail Perlengkapan & Palen',
      logoHorizontal: '/brand/logos/kup-horizontal.png',
      logoVertical: '/brand/logos/kup-vertical.png',
      logoEmblem: '/brand/logos/kup-emblem.png',
      badgeLabel: 'KUK PALEN',
    };
  }

  if (lower.includes('bangunan') || lower.includes('kub')) {
    return {
      unitCode: 'KUK-BANGUNAN',
      name: 'KUK Bangunan',
      subtitle: 'Material & Toko Bangunan',
      logoHorizontal: '/brand/logos/kub-horizontal.png',
      logoVertical: '/brand/logos/kub-vertical.png',
      logoEmblem: '/brand/logos/kub-emblem.png',
      badgeLabel: 'KUK BANGUNAN',
    };
  }

  // Default: TB KUK La Tansa
  return {
    unitCode: 'TB-LATANSA',
    name: 'TB KUK La Tansa',
    subtitle: 'Bahan Bangunan & Kaca',
    logoHorizontal: '/brand/logos/kul-horizontal.png',
    logoVertical: '/brand/logos/kul-vertical.png',
    logoEmblem: '/brand/logos/kul-emblem.png',
    badgeLabel: 'LA TANSA',
  };
}
