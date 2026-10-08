import type { ActiveByLayer } from '../../../shared/protocol';
import type { Layer } from '../../../shared/show';
import { Button } from '../ui/Button';

interface ClearLayerButtonProps {
  layer: Layer;
  active: ActiveByLayer;
  size?: 'md' | 'lg';
}

// Empties a Layer. Disabled while it has no active Scene.
export function ClearLayerButton({ layer, active, size }: ClearLayerButtonProps) {
  return (
    <Button
      size={size}
      aria-label={`Clear ${layer.name}`}
      disabled={active[layer.id] === undefined}
      onClick={() => window.engine.send({ type: 'clearLayer', layerId: layer.id })}
    >
      Clear
    </Button>
  );
}
