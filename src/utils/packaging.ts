/**
 * Chitra Crop Science Case Packaging Utility
 * Enforces B2B wholesale master case standards.
 * Standard carton master volume is 10 Litres / 10 Kg.
 */

export interface CasePackagingInfo {
  bottlesPerCase: number;
  unitLabel: string;
  totalVolume: string;
  caseSize: string;
}

export function getCasePackaging(packSize: string): CasePackagingInfo {
  const norm = (packSize || '').toLowerCase().trim();

  // 1 Litre -> 10 bottles per case (10 L total)
  if (norm.includes('1 l') || norm.includes('1 ltr') || norm.includes('1000 ml')) {
    return {
      bottlesPerCase: 10,
      unitLabel: 'bottles',
      totalVolume: '10 L total',
      caseSize: '10 bottles (10 L total)',
    };
  }

  // 500 ml -> 20 bottles per case (10 L total)
  if (norm.includes('500 ml')) {
    return {
      bottlesPerCase: 20,
      unitLabel: 'bottles',
      totalVolume: '10 L total',
      caseSize: '20 bottles (10 L total)',
    };
  }

  // 250 ml -> 40 bottles per case (10 L total)
  if (norm.includes('250 ml')) {
    return {
      bottlesPerCase: 40,
      unitLabel: 'bottles',
      totalVolume: '10 L total',
      caseSize: '40 bottles (10 L total)',
    };
  }

  // 100 ml -> 100 bottles per case (10 L total)
  if (norm.includes('100 ml')) {
    return {
      bottlesPerCase: 100,
      unitLabel: 'bottles',
      totalVolume: '10 L total',
      caseSize: '100 bottles (10 L total)',
    };
  }

  // 5 Litre -> 2 cans per case (10 L total)
  if (norm.includes('5 l') || norm.includes('5 ltr')) {
    return {
      bottlesPerCase: 2,
      unitLabel: 'cans',
      totalVolume: '10 L total',
      caseSize: '2 cans (10 L total)',
    };
  }

  // 5 ml -> 100 bottles display pack (0.5 L total)
  if (norm.includes('5 ml')) {
    return {
      bottlesPerCase: 100,
      unitLabel: 'bottles',
      totalVolume: '0.5 L total',
      caseSize: '100 bottles (0.5 L total)',
    };
  }

  // 1 Kg -> 10 packets / boxes (10 Kg total)
  if (norm.includes('1 kg') || norm.includes('1000 gm') || norm.includes('1000 g')) {
    return {
      bottlesPerCase: 10,
      unitLabel: 'packs',
      totalVolume: '10 Kg total',
      caseSize: '10 packs (10 Kg total)',
    };
  }

  // 500 Gm -> 20 packets (10 Kg total)
  if (norm.includes('500 gm') || norm.includes('500 g')) {
    return {
      bottlesPerCase: 20,
      unitLabel: 'packs',
      totalVolume: '10 Kg total',
      caseSize: '20 packs (10 Kg total)',
    };
  }

  // 250 Gm -> 40 packets (10 Kg total)
  if (norm.includes('250 gm') || norm.includes('250 g')) {
    return {
      bottlesPerCase: 40,
      unitLabel: 'packs',
      totalVolume: '10 Kg total',
      caseSize: '40 packs (10 Kg total)',
    };
  }

  // 100 Gm -> 100 packets (10 Kg total)
  if (norm.includes('100 gm') || norm.includes('100 g')) {
    return {
      bottlesPerCase: 100,
      unitLabel: 'packs',
      totalVolume: '10 Kg total',
      caseSize: '100 packs (10 Kg total)',
    };
  }

  // 5 Kg -> 2 bags (10 Kg total)
  if (norm.includes('5 kg')) {
    return {
      bottlesPerCase: 2,
      unitLabel: 'bags',
      totalVolume: '10 Kg total',
      caseSize: '2 bags (10 Kg total)',
    };
  }

  // Bulk packaging (25 kg, 30 kg, 50 kg)
  if (norm.includes('25 kg') || norm.includes('30 kg') || norm.includes('15 kg') || norm.includes('50 kg')) {
    return {
      bottlesPerCase: 1,
      unitLabel: 'bags',
      totalVolume: packSize,
      caseSize: `1 bulk bag (${packSize})`,
    };
  }

  // Fallback
  return {
    bottlesPerCase: 10,
    unitLabel: 'units',
    totalVolume: '10 Units total',
    caseSize: '10 units (1 Case)',
  };
}

export function computeProductCasePricing(bottlePrice: number, packSize: string): {
  bottlesPerCase: number;
  casePrice: number;
  caseSize: string;
  unitLabel: string;
} {
  const pkg = getCasePackaging(packSize);
  const casePrice = Math.round(bottlePrice * pkg.bottlesPerCase * 100) / 100;
  return {
    ...pkg,
    casePrice,
  };
}
