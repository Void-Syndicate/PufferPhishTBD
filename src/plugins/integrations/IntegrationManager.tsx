// IntegrationManager — Integration manager panel for Dimension/hookshot compatibility
// Supports opening integration manager UIs in an iframe widget frame

import { useState, useCallback } from 'react';
import { WidgetContainer } from '../widgets/WidgetContainer';
import type { WidgetInfo } from '../../stores/pluginStore';
import styles from '../widgets/WidgetContainer.module.css';

interface IntegrationManagerProps {
  roomId: string;
  onClose: () => void;
}

const DEFAULT_INTEGRATION_MANAGERS = [
  {
    name: 'Dimension',
    url: 'https://dimension.t2bot.io/widgets/',
    icon: '\uD83D\uDD27',
    description: 'Open-source integration manager for Matrix',
  },
  {
    name: 'Hookshot',
    url: 'https://hookshot.t2bot.io/',
    icon: '\uD83E\uDE9D',
    description: 'GitHub, GitLab, JIRA, and more',
  },
];

export default function IntegrationManager({ roomId, onClose }: IntegrationManagerProps) {
  const [activeManager, setActiveManager] = useState<WidgetInfo | null>(null);
  const [customUrl, setCustomUrl] = useState('');

  const openManager = useCallback(
    (name: string, url: string) => {
      // Build the integration manager URL with room context
      const fullUrl = `${url}?roomId=${encodeURIComponent(roomId)}`;
      setActiveManager({
        widgetId: `integration_manager_${Date.now()}`,
        name: `Integration Manager: ${name}`,
        type: 'm.integration_manager',
        url: fullUrl,
        roomId,
        creatorUserId: '',
      });
    },
    [roomId],
  );

  const openCustom = useCallback(() => {
    if (!customUrl.trim()) return;
    openManager('Custom', customUrl.trim());
    setCustomUrl('');
  }, [customUrl, openManager]);

  if (activeManager) {
    return (
      <div style={{ width: '100%', height: 500 }}>
        <WidgetContainer
          widget={activeManager}
          height={500}
          onRemove={() => setActiveManager(null)}
        />
      </div>
    );
  }

  return (
    <div className={styles.widgetPicker} style={{ position: 'relative', minWidth: 280 }}>
      <div className={styles.widgetPickerTitle}>
        {'\uD83D\uDD27'} Integration Managers
      </div>

      {DEFAULT_INTEGRATION_MANAGERS.map((mgr) => (
        <div
          key={mgr.name}
          className={styles.widgetPickerItem}
          onClick={() => openManager(mgr.name, mgr.url)}
        >
          <span className={styles.widgetPickerIcon}>{mgr.icon}</span>
          <span style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold' }}>{mgr.name}</div>
            <div style={{ fontSize: 9, color: '#888' }}>{mgr.description}</div>
          </span>
        </div>
      ))}

      <div className={styles.widgetPickerTitle} style={{ marginTop: 6 }}>
        Custom Integration Manager
      </div>
      <input
        className={styles.addWidgetInput}
        type="text"
        placeholder="Integration manager URL..."
        value={customUrl}
        onChange={(e) => setCustomUrl(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && openCustom()}
      />

      <div className={styles.widgetPickerActions}>
        <button className={styles.widgetPickerBtn} onClick={openCustom}>Open</button>
        <button className={styles.widgetPickerBtn} onClick={onClose}>Close</button>
      </div>

      <div style={{ marginTop: 8, padding: 4, fontSize: 9, color: '#888', borderTop: '1px solid #D0D0D0' }}>
        {'\u2139\uFE0F'} Integration managers let you add bots, bridges, and services to your rooms.
        Bot responses will display with formatted content and interactive elements when supported.
      </div>
    </div>
  );
}
