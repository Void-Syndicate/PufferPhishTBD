// WidgetContainer — Renders Matrix widgets in rooms (iframe-based)

import { useState, useRef, useEffect, useCallback } from 'react';
import { WidgetApi } from './WidgetAPI';
import { usePluginStore, type WidgetInfo } from '../../stores/pluginStore';
import styles from './WidgetContainer.module.css';

interface WidgetContainerProps {
  widget: WidgetInfo;
  height?: number;
  onRemove?: (widgetId: string) => void;
}

export function WidgetContainer({ widget, height = 300, onRemove }: WidgetContainerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetApiRef = useRef<WidgetApi | null>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const api = new WidgetApi(widget.widgetId);
    widgetApiRef.current = api;

    return () => {
      api.detach();
      widgetApiRef.current = null;
    };
  }, [widget.widgetId]);

  useEffect(() => {
    if (iframeRef.current && widgetApiRef.current) {
      widgetApiRef.current.attach(iframeRef.current);
    }
  }, [iframeRef.current]);

  const handleClose = useCallback(() => {
    onRemove?.(widget.widgetId);
  }, [widget.widgetId, onRemove]);

  return (
    <div
      className={styles.widgetFrame}
      style={{ height: minimized ? 'auto' : height }}
    >
      <div className={styles.widgetTitleBar}>
        <span className={styles.widgetTitle}>
          {'\uD83D\uDCC4'} {widget.name || 'Widget'}
        </span>
        <div className={styles.widgetTitleBtns}>
          <button
            className={styles.widgetBtn}
            onClick={() => setMinimized(!minimized)}
            title={minimized ? 'Expand' : 'Minimize'}
          >
            {minimized ? '\u25A1' : '_'}
          </button>
          <button
            className={styles.widgetBtn}
            onClick={handleClose}
            title="Close widget"
          >
            {'\u2716'}
          </button>
        </div>
      </div>
      {!minimized && (
        <div className={styles.widgetContent}>
          <iframe
            ref={iframeRef}
            src={widget.url}
            sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
            allow="microphone; camera; encrypted-media; display-capture"
            title={`Widget: ${widget.name}`}
          />
        </div>
      )}
    </div>
  );
}

/** Widget picker dropdown for room header */
interface WidgetPickerProps {
  roomId: string;
  onClose: () => void;
}

export function WidgetPicker({ roomId, onClose }: WidgetPickerProps) {
  const { activeWidgets, addWidget, removeWidget } = usePluginStore();
  const [newWidgetUrl, setNewWidgetUrl] = useState('');
  const [newWidgetName, setNewWidgetName] = useState('');

  const roomWidgets = activeWidgets.filter((w) => w.roomId === roomId);

  const handleAddWidget = () => {
    if (!newWidgetUrl.trim()) return;
    const widgetId = `custom_${Date.now()}`;
    addWidget({
      widgetId,
      name: newWidgetName.trim() || 'Custom Widget',
      type: 'm.custom',
      url: newWidgetUrl.trim(),
      roomId,
      creatorUserId: '',
    });
    setNewWidgetUrl('');
    setNewWidgetName('');
  };

  const handleRemoveWidget = (widgetId: string) => {
    removeWidget(widgetId);
  };

  return (
    <div className={styles.widgetPicker} onClick={(e) => e.stopPropagation()}>
      <div className={styles.widgetPickerTitle}>{'\uD83D\uDCC4'} Room Widgets</div>

      {roomWidgets.length === 0 ? (
        <div className={styles.widgetPickerEmpty}>No widgets in this room</div>
      ) : (
        roomWidgets.map((w) => (
          <div key={w.widgetId} className={styles.widgetPickerItem}>
            <span className={styles.widgetPickerIcon}>{'\uD83D\uDCC4'}</span>
            <span style={{ flex: 1 }}>{w.name}</span>
            <button
              className={styles.widgetPickerBtn}
              onClick={() => handleRemoveWidget(w.widgetId)}
            >
              Remove
            </button>
          </div>
        ))
      )}

      <div className={styles.widgetPickerTitle} style={{ marginTop: 6 }}>Add Widget</div>
      <input
        className={styles.addWidgetInput}
        type="text"
        placeholder="Widget name..."
        value={newWidgetName}
        onChange={(e) => setNewWidgetName(e.target.value)}
      />
      <input
        className={styles.addWidgetInput}
        type="text"
        placeholder="Widget URL..."
        value={newWidgetUrl}
        onChange={(e) => setNewWidgetUrl(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleAddWidget()}
      />
      <div className={styles.widgetPickerActions}>
        <button className={styles.widgetPickerBtn} onClick={handleAddWidget}>Add</button>
        <button className={styles.widgetPickerBtn} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
