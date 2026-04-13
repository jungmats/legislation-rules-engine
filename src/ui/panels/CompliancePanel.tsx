import type { ComplianceResult, ResolvedObligation } from '../../engine/types';
import type { ComplianceStatus } from '../../engine/threshold';
import { computeDeadline } from '../../engine/deadlines';
import type { RegulationIndex } from '../../engine/loader';
import type { FactMap } from '../../engine/types';
import DeadlineBadge from '../components/DeadlineBadge';

interface Props {
  complianceResults: ComplianceResult[];
  confirmed: ResolvedObligation[];
  index: RegulationIndex;
  factMap: FactMap;
  assessmentStarted: boolean;
}

function statusEmoji(status: ComplianceStatus['status']): string {
  switch (status) {
    case 'compliant':      return '✅';
    case 'risk':           return '⚠️';
    case 'violation':      return '❌';
    case 'pending':        return '⏳';
    case 'not_applicable': return '';
  }
}

function formatNumber(n: number, unit?: string): string {
  const formatted = Math.round(Math.abs(n)).toLocaleString();
  return unit ? `${formatted} ${unit}` : formatted;
}

function DeltaLine({ cs }: { cs: ComplianceStatus }) {
  if (cs.status === 'not_applicable' || cs.status === 'pending') return null;

  const { measured, threshold, delta, unit } = cs;

  return (
    <div className="mt-1 text-xs text-gray-500 space-y-0.5">
      <div className="flex gap-4">
        <span>Measured: <span className="font-medium text-gray-700">{formatNumber(measured, unit)}</span></span>
        <span>Target: ≤ <span className="font-medium text-gray-700">{formatNumber(threshold, unit)}</span></span>
      </div>
      {cs.status === 'violation' && (
        <div className="text-red-600 font-medium">
          Overshoot: +{formatNumber(delta, unit)} ({Math.round((delta / threshold) * 100)}% above target)
        </div>
      )}
      {cs.status === 'risk' && (
        <div className="text-amber-600">
          Headroom: {formatNumber(-delta, unit)} — within {cs.proximityPct}% of limit, monitor pace
        </div>
      )}
      {cs.status === 'compliant' && (
        <div className="text-green-600">
          Headroom: {formatNumber(-delta, unit)} below target
        </div>
      )}
    </div>
  );
}

function ActionLine({ cs, unit }: { cs: ComplianceStatus; unit?: string }) {
  if (cs.status !== 'violation') return null;
  const { delta } = cs;
  return (
    <div className="mt-1.5 text-xs text-red-700 font-medium">
      → Reduce by {formatNumber(delta, unit)} to meet this target
    </div>
  );
}

export default function CompliancePanel({
  complianceResults,
  confirmed,
  index,
  factMap,
  assessmentStarted,
}: Props) {
  const factLabels = new Map(Array.from(index.facts.values()).map((f) => [f.id, f.label]));

  if (!assessmentStarted) {
    return (
      <p className="text-xs text-gray-400 italic">
        Complete the compliance assessment to see results here.
      </p>
    );
  }

  // Group alternatives: map obligation id → alternative obligation id
  const altMap = new Map<string, string>();
  for (const { obligation } of confirmed) {
    if (obligation.alternative_obligation_id) {
      altMap.set(obligation.id, obligation.alternative_obligation_id);
    }
  }

  // Track which obligation ids are already rendered (to skip the paired alternative)
  const rendered = new Set<string>();

  const items = complianceResults.filter(
    (r) => (r.complianceStatus as ComplianceStatus).status !== 'not_applicable',
  );

  if (items.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic">
        No measurable thresholds found for confirmed obligations.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((result) => {
        if (rendered.has(result.obligationId)) return null;

        const cs = result.complianceStatus as ComplianceStatus;
        const altId = altMap.get(result.obligationId);
        const altResult = altId ? items.find((r) => r.obligationId === altId) : undefined;

        // For paired alternatives, resolve combined status
        let displayStatus = cs.status;
        if (altResult) {
          rendered.add(altId!);
          const altCs = altResult.complianceStatus as ComplianceStatus;
          // Compliant if either alternative is met
          if (cs.status === 'compliant' || altCs.status === 'compliant') {
            displayStatus = 'compliant';
          } else if (cs.status === 'violation' && altCs.status === 'violation') {
            displayStatus = 'violation';
          } else {
            displayStatus = 'risk';
          }
        }

        const resolvedOb = confirmed.find((r) => r.obligation.id === result.obligationId);
        if (!resolvedOb) return null;

        const deadline = computeDeadline(resolvedOb.deadlinePolicy, factMap, factLabels);

        const borderColor =
          displayStatus === 'violation' ? 'border-red-200 bg-red-50' :
          displayStatus === 'risk'      ? 'border-amber-200 bg-amber-50' :
          displayStatus === 'compliant' ? 'border-green-200 bg-green-50' :
          displayStatus === 'pending'   ? 'border-gray-200 bg-gray-50' :
          'border-gray-100';

        return (
          <div key={result.obligationId} className={`rounded-lg border p-3 ${borderColor}`}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-gray-800">
                {statusEmoji(displayStatus)} {resolvedOb.obligation.label}
              </span>
              <DeadlineBadge result={deadline} />
            </div>

            {altResult ? (
              // Paired alternatives: show each leg
              <div className="mt-2 space-y-2">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Option A (relative)</div>
                  <DeltaLine cs={cs} />
                  <ActionLine cs={cs} unit={resolvedOb.obligation.unit} />
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Option B (absolute)</div>
                  <DeltaLine cs={altResult.complianceStatus as ComplianceStatus} />
                  <ActionLine cs={altResult.complianceStatus as ComplianceStatus} unit={resolvedOb.obligation.unit} />
                </div>
              </div>
            ) : (
              <>
                <DeltaLine cs={cs} />
                {cs.status === 'pending' && (
                  <div className="mt-1 text-xs text-gray-400">
                    Missing: {(cs as Extract<ComplianceStatus, { status: 'pending' }>).missingFacts.join(', ')}
                  </div>
                )}
                <ActionLine cs={cs} unit={resolvedOb.obligation.unit} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
