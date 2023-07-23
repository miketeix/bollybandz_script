import {version, bitget} from 'ccxt';
import ta from 'ta.js';

const day = 86400000;
const timeframeConversionMap = { // timeframe to milliseconds
    '5m': day/288, 
    '15m': day/96,
    '1h': day/24,
    '4h': day/8,
    '1d': day,
    '1w': day*7,
}

const timeframeRecencyWindowMap = {
    '5m': 4, 
    '15m': 2,
    '1h': 2,
    '4h': 1,
    '1d': 1,
    '1w': 1,
}

async function fetchCandles(exchange, symbol, timeframe) {
    try {
        const timeframeInMillis = timeframeConversionMap[timeframe];
        const limit = 30;
        const since = exchange.milliseconds() - (timeframeInMillis * limit);

        const candles = await exchange.fetchOHLCV(symbol, timeframe, since, limit);
        console.log (exchange.iso8601 (exchange.milliseconds ()), exchange.id, symbol, timeframe, candles.length, 'OHLCV candles received')
        return candles
    } catch (e) {
        console.log (exchange.iso8601 (exchange.milliseconds ()), exchange.id, symbol, e.constructor.name, e.message)
    }
    
}

async function main() {
    const exchange = new bitget()
    await exchange.loadMarkets()
    // exchange.verbose = true // uncomment for debugging purposes if necessary
    const symbols = [
        'BTC/USDT',
        'LINK/USDT'
    ]
    const timeframes = ['5m','15m','1h','4h','1d','1w'];
    var bandHorizon = 20;
    var bandDeviations = 2.3; 

    const outlierSummary = {};
    for (let symbol of symbols) {
        for (let timeframe of timeframes) {
            const candles = await fetchCandles(exchange, symbol, timeframe);
            if (candles.length) {
                const closingValues = candles.map(([ts, open, high, low, close]) => close)
                const bollingerValues = ta.bands(closingValues, bandHorizon, bandDeviations);
                const recencyWindow = timeframeRecencyWindowMap[timeframe];
                const lastBandValues = bollingerValues.slice(-recencyWindow);
                const lastClosingValues = closingValues.slice(-recencyWindow);
                // console.log('closingValues', closingValues, 'bollingerValues', bollingerValues, 'lastBandValues', lastBandValues, 'lastClosingValues', lastClosingValues)

                const isOutsideRecentBand = lastBandValues.reduce((acc, [high, median, low], index) => {
                    if ((lastClosingValues[index] > high) || (lastClosingValues[index] < low)) {
                        return true;
                    }
                    return acc;
                }, false);
                
                if (isOutsideRecentBand) {
                    outlierSummary[symbol] = outlierSummary[symbol] ?  outlierSummary[symbol].concat(timeframe) :  [timeframe]
                }
            }
        }    
    }

    /**
     *   
     * {
            'BTC/USDT': {
                '5m': {
                    side: 'upper',
                    recency: 1
                },
                '1h': 'lower'
            }
        }
     * 
     */
  

    console.log('Outlier Summary', outlierSummary);
    
}

main()
