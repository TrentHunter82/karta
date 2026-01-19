import { useCanvasStore } from '../../../stores/canvasStore';
import { IconButton } from '../inputs/IconButton';

export function LayoutSection() {
  const alignObjects = useCanvasStore((s) => s.alignObjects);
  const distributeObjects = useCanvasStore((s) => s.distributeObjects);
  const selectedIds = useCanvasStore((s) => s.selectedIds);

  const hasMultiple = selectedIds.size > 1;
  const hasThreeOrMore = selectedIds.size >= 3;

  return (
    <section className="properties-section">
      <div className="section-header">
        <span className="section-title">Align</span>
      </div>
      <div className="section-content">
        <div className="button-row">
          <IconButton icon="align-left" onClick={() => alignObjects('left')} disabled={!hasMultiple} title="Align left" />
          <IconButton icon="align-center-h" onClick={() => alignObjects('centerH')} disabled={!hasMultiple} title="Align center horizontally" />
          <IconButton icon="align-right" onClick={() => alignObjects('right')} disabled={!hasMultiple} title="Align right" />
          <IconButton icon="align-top" onClick={() => alignObjects('top')} disabled={!hasMultiple} title="Align top" />
          <IconButton icon="align-center-v" onClick={() => alignObjects('centerV')} disabled={!hasMultiple} title="Align center vertically" />
          <IconButton icon="align-bottom" onClick={() => alignObjects('bottom')} disabled={!hasMultiple} title="Align bottom" />
        </div>

        <div className="section-header" style={{ marginTop: '8px' }}>
          <span className="section-title">Distribute</span>
        </div>
        <div className="button-row">
          <IconButton icon="distribute-h" onClick={() => distributeObjects('horizontal')} disabled={!hasThreeOrMore} title="Distribute horizontally" />
          <IconButton icon="distribute-v" onClick={() => distributeObjects('vertical')} disabled={!hasThreeOrMore} title="Distribute vertically" />
        </div>
      </div>
    </section>
  );
}
