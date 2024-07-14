# Price Sensitivity Meter (PSM) Analysis

This repository contains two different implementations of Price Sensitivity Meter (PSM) analysis:

1. PSM_Interpolation.ts
2. PSM_Normal.ts

## English

### PSM_Interpolation.ts

This implementation uses an interpolation method for calculating PSM metrics.

**Key Features:**
- Flexible input: Can handle various price points without predefined ranges.
- Interpolation: Fills gaps in data, potentially providing smoother curves.
- Output: Generates 'psm_chart_interpolated.html'

**Merits:**
- More adaptable to different datasets
- Can provide more detailed analysis across a continuous price range
- Potentially more accurate for datasets with irregular price intervals

**Demerits:**
- May introduce some inaccuracies due to interpolation
- More complex algorithm, potentially slower for large datasets
- Might be overkill for simple, regularly spaced price data

### PSM_Normal.ts

This implementation uses a fixed set of price points for PSM analysis.

**Key Features:**
- Predefined price points: Uses a set list of prices for analysis.
- Direct calculation: No interpolation, works directly with given data.
- Output: Generates 'psm_chart_normal.html'

**Merits:**
- Simpler implementation, easier to understand and maintain
- Faster processing for datasets that match the predefined price points
- More predictable results, especially for standardized surveys

**Demerits:**
- Less flexible with varying price ranges
- May miss important data points between predefined prices
- Could be less accurate for datasets that don't align with predefined points

### Usage

Both scripts accept a CSV file as input. Run them using:

ts-node PSM_Interpolation.ts --csvfile your_data.csv

ts-node PSM_Normal.ts --csvfile your_data.csv
