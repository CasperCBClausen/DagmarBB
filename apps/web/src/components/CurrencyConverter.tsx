import React from 'react';
import { useCurrencyRates } from '../hooks/useCurrencyRates';

interface CurrencyConverterProps {
  amountDKK: number;
}

export function CurrencyConverter({ amountDKK }: CurrencyConverterProps) {
  const { rates, loading } = useCurrencyRates();

  if (loading) {
    return (
      <div style={{ fontSize: '0.8rem', color: '#aaa', marginTop: '0.375rem' }}>
        <span style={{
          display: 'inline-block',
          width: '180px',
          height: '0.875rem',
          backgroundColor: '#e5e7eb',
          borderRadius: '3px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      </div>
    );
  }

  if (!rates) return null;

  const conversions = [
    { code: 'EUR', symbol: '€', value: Math.round(amountDKK * rates.EUR) },
    { code: 'USD', symbol: '$', value: Math.round(amountDKK * rates.USD) },
    { code: 'GBP', symbol: '£', value: Math.round(amountDKK * rates.GBP) },
    { code: 'SEK', symbol: 'SEK', value: Math.round(amountDKK * rates.SEK) },
    { code: 'NOK', symbol: 'NOK', value: Math.round(amountDKK * rates.NOK) },
  ];

  return (
    <div style={{ fontSize: '0.78rem', color: '#888', marginTop: '0.375rem', lineHeight: 1.4 }}>
      ≈{' '}
      {conversions.map((c, i) => (
        <React.Fragment key={c.code}>
          {i > 0 && <span style={{ margin: '0 0.25rem', opacity: 0.4 }}>·</span>}
          <span title={c.code}>
            {c.code === 'EUR' || c.code === 'USD' || c.code === 'GBP'
              ? `${c.symbol}${c.value.toLocaleString()}`
              : `${c.value.toLocaleString()} ${c.symbol}`}
          </span>
        </React.Fragment>
      ))}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
