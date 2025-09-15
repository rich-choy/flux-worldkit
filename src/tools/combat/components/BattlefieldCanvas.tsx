import { useEffect, useRef } from 'react';
import { Team, CombatFacing } from '@flux';

interface BattlefieldCanvasProps {
  session: any;
  width?: number;
  height?: number;
}

export function BattlefieldCanvas({ session, width = 560, height = 200 }: BattlefieldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !session) return;

    // Debug logging to see if effect is running and what data we have
    console.log('🎨 BattlefieldCanvas re-rendering, session ID:', session.id);
    if (session.data?.combatants) {
      for (const [actorId, combatant] of session.data.combatants) {
        console.log(`  ${actorId}: position ${combatant.position.coordinate}m`);
      }
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with worldkit-style background
    ctx.fillStyle = '#f9fafb'; // gray-50 background
    ctx.fillRect(0, 0, width, height);

    // Draw battlefield grid
    ctx.strokeStyle = '#d1d5db'; // gray-300
    ctx.lineWidth = 1;

    // Main battlefield line
    const battlefieldY = height / 2;
    ctx.beginPath();
    ctx.moveTo(40, battlefieldY);
    ctx.lineTo(width - 40, battlefieldY);
    ctx.stroke();

    // Distance markers
    ctx.fillStyle = '#6b7280'; // gray-500
    ctx.font = '12px ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace';
    ctx.textAlign = 'center';

    const battlefieldWidth = width - 80;
    const positions = [0, 100, 200, 300];
    positions.forEach(pos => {
      const x = 40 + (pos / 300) * battlefieldWidth;
      ctx.fillText(`${pos}m`, x, battlefieldY - 10);

      // Vertical tick marks
      ctx.beginPath();
      ctx.moveTo(x, battlefieldY - 5);
      ctx.lineTo(x, battlefieldY + 5);
      ctx.stroke();
    });

    // Combat zone highlight (100m-200m)
    const combatZoneStart = 40 + (100 / 300) * battlefieldWidth;
    const combatZoneEnd = 40 + (200 / 300) * battlefieldWidth;
    ctx.fillStyle = 'rgba(251, 191, 36, 0.1)'; // yellow-400 with opacity
    ctx.fillRect(combatZoneStart, battlefieldY + 10, combatZoneEnd - combatZoneStart, 30);

    ctx.fillStyle = '#f59e0b'; // yellow-500
    ctx.font = '12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Combat Zone', (combatZoneStart + combatZoneEnd) / 2, battlefieldY + 30);

    // Draw combatants
    if (session.data?.combatants) {
      for (const [, combatant] of session.data.combatants) {
        const x = 40 + (combatant.position.coordinate / 300) * battlefieldWidth;
        const y = battlefieldY + 60;

        // Team colors - using worldkit color scheme
        const color = combatant.team === Team.BRAVO ? '#ef4444' : '#3b82f6'; // red-500 : blue-500

        // Chevron direction based on facing
        const chevron = combatant.position.facing === CombatFacing.RIGHT ? '>' : '<';

        ctx.fillStyle = color;
        ctx.font = '24px ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(chevron, x, y);

        // Actor name and position
        ctx.font = '11px ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace';
        ctx.fillText(`${combatant.actorId.split(':').pop()} (${combatant.position.coordinate}m)`, x, y + 20);

        // Velocity indicator
        if (combatant.position.velocity > 0) {
          ctx.fillText(`→ ${combatant.position.velocity.toFixed(1)} m/s`, x, y + 35);
        }
      }
    }

  }, [session, width, height]);

  return (
    <div className="battlefield-container bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-medium text-gray-900">Battlefield (300m)</h3>
      </div>
      <div className="p-4">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-auto border border-gray-200 rounded"
        />
      </div>
    </div>
  );
}
