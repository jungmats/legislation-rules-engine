import { useState } from 'react';
import type { Fact } from '../../engine/types';

interface Props {
  fact: Fact;
  onAnswer: (value: unknown) => void;
  onSkip: () => void;
  questionNumber: number;
  whyAsked: string;
}

export default function FactQuestion({ fact, onAnswer, onSkip, questionNumber, whyAsked }: Props) {
  const [value, setValue] = useState<string>('');

  function handleSubmit() {
    if (value === '') return;
    onAnswer(parseValue(fact, value));
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">
        Question {questionNumber}
      </div>
      <h3 className="text-lg font-medium mb-1">{fact.label}</h3>
      {fact.source && (
        <p className="text-sm text-gray-500 mb-4">{fact.source}</p>
      )}
      {fact.source_article && (
        <p className="text-xs text-gray-400 mb-4">Reference: {fact.source_article}</p>
      )}

      <div className="mb-5">
        {fact.type === 'boolean' && (
          <div className="flex gap-3">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                onClick={() => onAnswer(v)}
                className="text-left px-5 py-2 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-sm font-medium transition-all"
              >
                {v ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        )}

        {fact.type === 'enum' && fact.allowed_values && (
          <div className="flex flex-col gap-2">
            {fact.allowed_values.map((v) => {
              const description = fact.value_descriptions?.[v];
              return (
                <button
                  key={v}
                  onClick={() => onAnswer(v)}
                  className="text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-500 hover:bg-blue-50 text-sm transition-all"
                >
                  <div className="font-medium">{v}</div>
                  {description && (
                    <div className="text-xs text-gray-500 mt-1">{description}</div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {(fact.type === 'number' || fact.type === 'integer' || fact.type === 'string' || fact.type === 'date') && (
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <input
                type={fact.type === 'number' || fact.type === 'integer' ? 'number' : fact.type === 'date' ? 'date' : 'text'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={fact.unit ? `Value in ${fact.unit}` : 'Enter value'}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-blue-500 focus:outline-none text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={value === ''}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
            >
              Confirm
            </button>
          </div>
        )}
      </div>

      <div className="flex items-start justify-between border-t border-gray-100 pt-4">
        <p className="text-xs text-gray-400 max-w-sm">
          <span className="font-medium text-gray-500">Why this question: </span>
          {whyAsked}
        </p>
        <button
          onClick={onSkip}
          className="text-xs text-gray-400 hover:text-gray-600 underline ml-4 shrink-0"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

function parseValue(fact: Fact, raw: string): unknown {
  if (fact.type === 'number' || fact.type === 'integer') return parseFloat(raw);
  if (fact.type === 'boolean') return raw === 'true';
  return raw;
}
