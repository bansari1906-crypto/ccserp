/**
 * Chitra Crop Science Master Case Packaging Utility
 * Enforces B2B wholesale master case standards from the official price list.
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
  if (norm.includes('500 ml') || norm.includes('500ml')) {
    return {
      bottlesPerCase: 20,
      unitLabel: 'bottles',
      totalVolume: '10 L total',
      caseSize: '20 bottles (10 L total)',
    };
  }

  // 300 ml -> 20 bottles per case (6 L total)
  if (norm.includes('300 ml')) {
    return {
      bottlesPerCase: 20,
      unitLabel: 'bottles',
      totalVolume: '6 L total',
      caseSize: '20 bottles (6 L total)',
    };
  }

  // 250 ml -> 40 bottles per case (10 L total)
  if (norm.includes('250 ml') || norm.includes('250ml')) {
    return {
      bottlesPerCase: 40,
      unitLabel: 'bottles',
      totalVolume: '10 L total',
      caseSize: '40 bottles (10 L total)',
    };
  }

  // 150 ml -> 40 bottles per case (6 L total)
  if (norm.includes('150 ml')) {
    return {
      bottlesPerCase: 40,
      unitLabel: 'bottles',
      totalVolume: '6 L total',
      caseSize: '40 bottles (6 L total)',
    };
  }

  // 100 ml -> 100 bottles per case (10 L total)
  if (norm.includes('100 ml') || norm.includes('100ml')) {
    return {
      bottlesPerCase: 100,
      unitLabel: 'bottles',
      totalVolume: '10 L total',
      caseSize: '100 bottles (10 L total)',
    };
  }

  // 60 ml -> 100 bottles per case (6 L total)
  if (norm.includes('60 ml')) {
    return {
      bottlesPerCase: 100,
      unitLabel: 'bottles',
      totalVolume: '6 L total',
      caseSize: '100 bottles (6 L total)',
    };
  }

  // 30 ml -> 100 bottles per case (3 L total)
  if (norm.includes('30 ml')) {
    return {
      bottlesPerCase: 100,
      unitLabel: 'bottles',
      totalVolume: '3 L total',
      caseSize: '100 bottles (3 L total)',
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
  if (norm.includes('5 ml') || norm.includes('5ml')) {
    return {
      bottlesPerCase: 100,
      unitLabel: 'bottles',
      totalVolume: '0.5 L total',
      caseSize: '100 bottles (0.5 L total)',
    };
  }

  // 1 Kg / 1000 Gm -> 10 packets (10 Kg total)
  if (norm.includes('1 kg') || norm.includes('1000 gm') || norm.includes('1000 g')) {
    return {
      bottlesPerCase: 10,
      unitLabel: 'packs',
      totalVolume: '10 Kg total',
      caseSize: '10 packs (10 Kg total)',
    };
  }

  // 1200 Gm -> 10 packets (12 Kg total)
  if (norm.includes('1200 gm') || norm.includes('1200 g')) {
    return {
      bottlesPerCase: 10,
      unitLabel: 'packs',
      totalVolume: '12 Kg total',
      caseSize: '10 packs (12 Kg total)',
    };
  }

  // 600 Gm -> 20 packets (12 Kg total)
  if (norm.includes('600 gm') || norm.includes('600 g')) {
    return {
      bottlesPerCase: 20,
      unitLabel: 'packs',
      totalVolume: '12 Kg total',
      caseSize: '20 packs (12 Kg total)',
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

  // 300 Gm -> 40 packets (12 Kg total)
  if (norm.includes('300 gm') || norm.includes('300 g')) {
    return {
      bottlesPerCase: 40,
      unitLabel: 'packs',
      totalVolume: '12 Kg total',
      caseSize: '40 packs (12 Kg total)',
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

  // 40 Gm -> 100 packets (4 Kg total)
  if (norm.includes('40 gm') || norm.includes('40 g')) {
    return {
      bottlesPerCase: 100,
      unitLabel: 'packs',
      totalVolume: '4 Kg total',
      caseSize: '100 packs (4 Kg total)',
    };
  }

  // 1 Gm x 10 Pcs -> 50 pouches (0.5 Kg total)
  if (norm.includes('1 gm x 10 pcs') || norm.includes('1 gm x 10')) {
    return {
      bottlesPerCase: 50,
      unitLabel: 'pouches',
      totalVolume: '0.5 Kg total',
      caseSize: '50 pouches (0.5 Kg total)',
    };
  }

  // 3 Kg -> 4 bags (12 Kg total)
  if (norm.includes('3 kg')) {
    return {
      bottlesPerCase: 4,
      unitLabel: 'bags',
      totalVolume: '12 Kg total',
      caseSize: '4 bags (12 Kg total)',
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

  // 10 Kg -> 1 bag (10 Kg total)
  if (norm.includes('10 kg')) {
    return {
      bottlesPerCase: 1,
      unitLabel: 'bags',
      totalVolume: '10 Kg total',
      caseSize: '1 bag (10 Kg total)',
    };
  }

  // Bulk packaging (15 kg bucket, 25 kg, 30 kg bag, 30 kg drum, 50 kg)
  if (
    norm.includes('25 kg') ||
    norm.includes('30 kg') ||
    norm.includes('15 kg') ||
    norm.includes('50 kg')
  ) {
    const isBucket = norm.includes('bucket');
    const isDrum = norm.includes('drum');
    const containerType = isBucket ? 'bucket' : isDrum ? 'drum' : 'bag';
    return {
      bottlesPerCase: 1,
      unitLabel: containerType,
      totalVolume: packSize,
      caseSize: `1 bulk ${containerType} (${packSize})`,
    };
  }

  // Default Fallback
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
