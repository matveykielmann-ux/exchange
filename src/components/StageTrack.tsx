import { ORDER_STAGE_LABEL, ORDER_STAGE_PATH, type OrderStage } from '@/domain/order';

/**
 * The five-stage progress indicator (New → Awaiting Payment → Payment Review →
 * Processing → Completed). It only reflects the stage the server reports;
 * the pulse on the current stage is decoration, never a status of its own.
 */
export function StageTrack({ stage, label = 'Order stage' }: { stage: OrderStage; label?: string }) {
  const index = ORDER_STAGE_PATH.indexOf(stage);
  // Off the main path (held, rejected, cancelled, refund): show how far the order got without implying progress.
  const offPath = index === -1;
  const held = stage === 'on_hold';
  return (
    <div className="stack" style={{ gap: 8 }}>
      <ol className={`stage-track${held ? ' is-held' : ''}`} aria-label={label}>
        {ORDER_STAGE_PATH.map((s, i) => {
          const state = offPath ? 'upcoming' : i < index || stage === 'completed' ? 'done' : i === index ? 'current' : 'upcoming';
          return (
            <li key={s} className={`is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="stage-track__bar" aria-hidden="true" />
              <span>{ORDER_STAGE_LABEL[s]}</span>
            </li>
          );
        })}
      </ol>
      {offPath ? (
        <p className="small">
          <span className="badge badge--warn">{ORDER_STAGE_LABEL[stage]}</span>
        </p>
      ) : null}
    </div>
  );
}
