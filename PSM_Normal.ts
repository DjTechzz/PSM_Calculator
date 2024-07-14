import fs from 'fs';
import csv from 'csv-parser';
import yargs from 'yargs';

const pricePoints = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600];
const responses: Array<{ expensive: number, cheap: number, tooExpensive: number, tooCheap: number }> = [];

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

const csvFileName = argv.csvfile;

fs.createReadStream(csvFileName)
  .pipe(csv())
  .on('data', (data) => {
    responses.push({
      expensive: parseFloat(data['高い']),
      cheap: parseFloat(data['安い']),
      tooExpensive: parseFloat(data['高すぎる']),
      tooCheap: parseFloat(data['安すぎる'])
    });
  })
  .on('end', () => {
    const expensivePercentages = calculatePercentages(responses, 'expensive', false);
    const cheapPercentages = calculatePercentages(responses, 'cheap', true);
    const tooExpensivePercentages = calculatePercentages(responses, 'tooExpensive', false);
    const tooCheapPercentages = calculatePercentages(responses, 'tooCheap', true);

    const tableData = expensivePercentages.map((expensivePercentage, index) => ({
      Price: pricePoints[index].toString(),
      Expensive: expensivePercentages[index],
      Cheap: cheapPercentages[index],
      TooExpensive: tooExpensivePercentages[index],
      TooCheap: tooCheapPercentages[index]
    }));

    // Calculate PSM prices
    const pmeValue = findCrossPoints(tableData, 'TooExpensive', 'Cheap');
    console.log(`Highest Price (PME): ${pmeValue.targetPoint}`);

    const ippValue = findCrossPoints(tableData, 'Expensive', 'Cheap');
    console.log(`Compromise Price (IPP): ${ippValue.targetPoint}`);

    const oppValue = findCrossPoints(tableData, 'TooExpensive', 'TooCheap');
    console.log(`Ideal Price (OPP): ${oppValue.targetPoint}`);

    const pmcValue = findCrossPoints(tableData, 'Expensive', 'TooCheap');
    console.log(`Guaranteed Quality Minimum Price (PMC): ${pmcValue.targetPoint}`);

    // Generate and save the chart
    const cumulativePercentages = {
      tooExpensive: new Map(tableData.map(row => [parseInt(row.Price), row.TooExpensive])),
      expensive: new Map(tableData.map(row => [parseInt(row.Price), row.Expensive])),
      cheap: new Map(tableData.map(row => [parseInt(row.Price), row.Cheap])),
      tooCheap: new Map(tableData.map(row => [parseInt(row.Price), row.TooCheap]))
    };

    const chartHtml = generateChartHtml(cumulativePercentages);
    fs.writeFileSync('psm_chart_normal.html', chartHtml);
    console.log('Chart saved as psm_char_normal.html');
  });

function calculatePercentages(responses: Array<{ [key: string]: number }>, key: string, invert: boolean) {
  let counts = new Array(pricePoints.length).fill(0);

  responses.forEach(response => {
    pricePoints.forEach((price, index) => {
      if (invert ? response[key] >= price : response[key] <= price) {
        counts[index]++;
      }
    });
  });

  return counts.map(count => ((count / responses.length) * 100).toFixed(1));
}

function findCrossPoints(tableData: Array<{ Price: string, [key: string]: string }>, col1: string, col2: string) {
  let crossPointBefore = { price: 'Not Found', col1: '0', col2: '0' };
  let crossPointAfter = { price: 'Not Found', col1: '0', col2: '0' };
  let foundCrossPoint = false;

  for (let i = 0; i < tableData.length; i++) {
    const percentage1 = parseFloat(tableData[i][col1]);
    const percentage2 = parseFloat(tableData[i][col2]);

    if (percentage1 > percentage2 && !foundCrossPoint) {
      crossPointAfter = {
        price: tableData[i].Price,
        col1: tableData[i][col1],
        col2: tableData[i][col2]
      };
      if (i > 0) {
        crossPointBefore = {
          price: tableData[i - 1].Price,
          col1: tableData[i - 1][col1],
          col2: tableData[i - 1][col2]
        };
      }
      foundCrossPoint = true;
      break;
    }
  }

  let x1 = parseFloat(crossPointBefore.price);
  let x2 = parseFloat(crossPointAfter.price);
  let y1 = parseFloat(crossPointBefore.col1);
  let y2 = parseFloat(crossPointAfter.col1);
  let y3 = parseFloat(crossPointBefore.col2);
  let y4 = parseFloat(crossPointAfter.col2);

  let targetPointCalculation = ((y3 - y1) * ((x1 - x2) ** 2) + x1 * (y1 - y2) * (x1 - x2) - x1 * (y3 - y4) * (x1 - x2)) / ((y1 - y2) * (x1 - x2) - (x1 - x2) * (y3 - y4));
  let targetPoint = targetPointCalculation.toFixed(2);

  return { x1, x2, y1, y2, y3, y4, targetPoint };
}

function generateChartHtml(cumulativePercentages: { tooExpensive: Map<number, string>, expensive: Map<number, string>, cheap: Map<number, string>, tooCheap: Map<number, string> }): string {
  const prices = pricePoints;

  const datasets = [
    { label: 'Too Expensive', data: prices.map(price => parseFloat(cumulativePercentages.tooExpensive.get(price) || '0')), borderColor: 'blue', fill: false },
    { label: 'Expensive', data: prices.map(price => parseFloat(cumulativePercentages.expensive.get(price) || '0')), borderColor: 'red', fill: false },
    { label: 'Cheap', data: prices.map(price => parseFloat(cumulativePercentages.cheap.get(price) || '0')), borderColor: 'orange', fill: false },
    { label: 'Too Cheap', data: prices.map(price => parseFloat(cumulativePercentages.tooCheap.get(price) || '0')), borderColor: 'yellow', fill: false }
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