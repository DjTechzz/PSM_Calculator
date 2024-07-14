import * as fs from 'fs';
import csv from 'csv-parser';
import yargs from 'yargs';

interface PSMData {
  tooExpensive: Map<number, number>;
  expensive: Map<number, number>;
  cheap: Map<number, number>;
  tooCheap: Map<number, number>;
}

interface CumulativePercentages {
  tooExpensive: Map<number, number>;
  expensive: Map<number, number>;
  cheap: Map<number, number>;
  tooCheap: Map<number, number>;
}

interface PSMPrices {
  highestPrice: number;
  compromisePrice: number;
  idealPrice: number;
  guaranteedQualityMinPrice: number;
}

// Configure yargs to get the CSV file path from command-line arguments
const argv = yargs
  .option('csvfile', {
    alias: 'f',
    description: 'Path to the CSV file',
    type: 'string',
    demandOption: true // Make it a required flag
  })
  .help()
  .alias('help', 'h')
  .parseSync();

const results: any[] = [];

fs.createReadStream(argv.csvfile)
  .pipe(csv())
  .on('data', (data: any) => {
    results.push(data);
  })
  .on('end', () => {
    performPSMAnalysis(results);
  });

function performPSMAnalysis(data: any[]) {
  const tabulated = tabulateResponses(data);
  const prices = calculatePSMPrices(tabulated);

  console.log(`Highest Price: ${prices.highestPrice} yen`);
  console.log(`Compromise Price: ${prices.compromisePrice} yen`);
  console.log(`Ideal Price: ${prices.idealPrice} yen`);
  console.log(`Guaranteed Quality Minimum Price: ${prices.guaranteedQualityMinPrice} yen`);
}

function tabulateResponses(data: any[]): PSMData {
  const tabulated: PSMData = {
    tooExpensive: new Map<number, number>(),
    expensive: new Map<number, number>(),
    cheap: new Map<number, number>(),
    tooCheap: new Map<number, number>()
  };
  
  data.forEach((row) => {
    incrementMap(tabulated.tooExpensive, parseInt(row['高すぎる']));
    incrementMap(tabulated.expensive, parseInt(row['高い']));
    incrementMap(tabulated.cheap, parseInt(row['安い']));
    incrementMap(tabulated.tooCheap, parseInt(row['安すぎる']));
  });
  
  return tabulated;
}

function incrementMap(map: Map<number, number>, value: number) {
  if (isNaN(value)) {
    console.warn('Warning: NaN value encountered');
    return;
  }
  if (map.has(value)) {
    map.set(value, map.get(value)! + 1);
  } else {
    map.set(value, 1);
  }
}

function calculatePSMPrices(tabulated: PSMData): PSMPrices {
  const cumulativePercentages: CumulativePercentages = {
    tooExpensive: getCumulativePercentages(tabulated.tooExpensive, false),
    expensive: getCumulativePercentages(tabulated.expensive, false),
    cheap: getCumulativePercentages(tabulated.cheap, true),
    tooCheap: getCumulativePercentages(tabulated.tooCheap, true)
  };

  console.log('Cumulative Percentages:');
  console.log('Too Expensive:', cumulativePercentages.tooExpensive);
  console.log('Expensive:', cumulativePercentages.expensive);
  console.log('Cheap:', cumulativePercentages.cheap);
  console.log('Too Cheap:', cumulativePercentages.tooCheap);

  const highestPrice = calculateIntersection(cumulativePercentages.tooExpensive, cumulativePercentages.cheap);
  const idealPrice = calculateIntersection(cumulativePercentages.cheap, cumulativePercentages.expensive);
  const compromisePrice = calculateIntersection(cumulativePercentages.tooExpensive, cumulativePercentages.tooCheap);
  const guaranteedQualityMinPrice = calculateIntersection(cumulativePercentages.tooCheap, cumulativePercentages.expensive);

  console.log(`Calculated Prices:`);
  console.log(`Highest Price: ${highestPrice}`);
  console.log(`Ideal Price: ${idealPrice}`);
  console.log(`Compromise Price: ${compromisePrice}`);
  console.log(`Guaranteed Quality Minimum Price: ${guaranteedQualityMinPrice}`);

  // Generate and save the chart
  const chartHtml = generateChartHtml(cumulativePercentages);
  fs.writeFileSync('psm_chart_interpolated.html', chartHtml);
  console.log('Chart saved as psm_chart_interpolated.html');

  return {
    highestPrice,
    idealPrice,
    compromisePrice,
    guaranteedQualityMinPrice
  };
}

function getCumulativePercentages(map: Map<number, number>, invert: boolean): Map<number, number> {
  const cumulative = new Map<number, number>();
  let cumulativeCount = 0;
  const totalCount = Array.from(map.values()).reduce((a, b) => a + b, 0);

  const sortedKeys = Array.from(map.keys()).sort((a, b) => a - b);
  sortedKeys.forEach((key) => {
    cumulativeCount += map.get(key)!;
    const percentage = (cumulativeCount / totalCount) * 100;
    cumulative.set(key, invert ? 100 - percentage : percentage);
  });

  return interpolateMissingData(cumulative, sortedKeys);
}

function interpolateMissingData(map: Map<number, number>, sortedKeys: number[]): Map<number, number> {
  const interpolatedMap = new Map<number, number>();
  const xs = sortedKeys;
  const ys = sortedKeys.map(key => map.get(key)!);

  for (let i = xs[0]; i <= xs[xs.length - 1]; i++) {
    interpolatedMap.set(i, linearInterpolation(i, xs, ys));
  }

  return interpolatedMap;
}

function linearInterpolation(x: number, xs: number[], ys: number[]): number {
  for (let i = 1; i < xs.length; i++) {
    if (x < xs[i]) {
      const x0 = xs[i - 1], x1 = xs[i];
      const y0 = ys[i - 1], y1 = ys[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return ys[ys.length - 1];
}

function calculateIntersection(map1: Map<number, number>, map2: Map<number, number>): number {
  let intersection = 0;
  let minDiff = Number.MAX_VALUE;

  map1.forEach((value1, key) => {
    if (map2.has(key)) {
      const value2 = map2.get(key)!;
      const diff = Math.abs(value1 - value2);
      if (diff < minDiff) {
        minDiff = diff;
        intersection = key;
      }
    }
  });

  return intersection;
}

function generateChartHtml(cumulativePercentages: CumulativePercentages): string {
  const prices = Array.from(new Set<number>([
    ...Array.from(cumulativePercentages.tooExpensive.keys()),
    ...Array.from(cumulativePercentages.expensive.keys()),
    ...Array.from(cumulativePercentages.cheap.keys()),
    ...Array.from(cumulativePercentages.tooCheap.keys())
  ])).sort((a, b) => a - b);

  const datasets = [
    { label: 'Too Expensive', data: prices.map(price => cumulativePercentages.tooExpensive.get(price) || 0), borderColor: 'blue', fill: false },
    { label: 'Expensive', data: prices.map(price => cumulativePercentages.expensive.get(price) || 0), borderColor: 'red', fill: false },
    { label: 'Cheap', data: prices.map(price => cumulativePercentages.cheap.get(price) || 0), borderColor: 'orange', fill: false },
    { label: 'Too Cheap', data: prices.map(price => cumulativePercentages.tooCheap.get(price) || 0), borderColor: 'yellow', fill: false }
  ];

  const chartData = JSON.stringify({ labels: prices, datasets });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Price Sensitivity Meter</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body>
      <canvas id="psmChart" width="800" height="400"></canvas>
      <script>
        const ctx = document.getElementById('psmChart').getContext('2d');
        new Chart(ctx, {
          type: 'line',
          data: ${chartData},
          options: {
            responsive: true,
            title: {
              display: true,
              text: 'Price Sensitivity Meter'
            },
            scales: {
              x: {
                title: {
                  display: true,
                  text: 'Price'
                }
              },
              y: {
                title: {
                  display: true,
                  text: 'Cumulative Percentage'
                },
                min: 0,
                max: 100
              }
            }
          }
        });
      </script>
    </body>
    </html>
  `;
}