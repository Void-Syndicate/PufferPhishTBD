import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./MenuBar.module.css";

export interface MenuAction {
  onNewRoom: () => void;
  onJoinRoom: () => void;
  onSettings: () => void;
  onSignOff: () => void;
  onPreferences: () => void;
  onFind: () => void;
  onMemberList: () => void;
  onInviteFriend: () => void;
  onMyProfile: () => void;
  onCreateRoom: () => void;
  onRoomDirectory: () => void;
  onRoomSettings: () => void;
  onAbout: () => void;
  onKeyboardShortcuts: () => void;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  action?: keyof MenuAction;
  separator?: boolean;
}

interface MenuDef {
  label: string;
  items: MenuItem[];
}

const MENUS: MenuDef[] = [
  {
    label: "File",
    items: [
      { label: "New Room", action: "onNewRoom" },
      { label: "Join Room", action: "onJoinRoom" },
      { label: "Settings", action: "onSettings" },
      { separator: true, label: "" },
      { label: "Sign Off", action: "onSignOff" },
    ],
  },
  {
    label: "Edit",
    items: [
      { label: "Preferences", action: "onPreferences" },
      { separator: true, label: "" },
      { label: "Find", shortcut: "Ctrl+F", action: "onFind" },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Member List", action: "onMemberList" },
      { label: "Invite Friend", action: "onInviteFriend" },
      { separator: true, label: "" },
      { label: "My Profile", action: "onMyProfile" },
    ],
  },
  {
    label: "Rooms",
    items: [
      { label: "Create Room", action: "onCreateRoom" },
      { label: "Join Room", action: "onJoinRoom" },
      { separator: true, label: "" },
      { label: "Room Directory", action: "onRoomDirectory" },
      { separator: true, label: "" },
      { label: "Room Settings", action: "onRoomSettings" },
    ],
  },
  {
    label: "Help",
    items: [
      { label: "About PufferChat", action: "onAbout" },
      { separator: true, label: "" },
      { label: "Keyboard Shortcuts", action: "onKeyboardShortcuts" },
    ],
  },
];

interface MenuBarProps {
  actions: MenuAction;
}

export default function MenuBar({ actions }: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpenMenu(null), []);

  useEffect(() => {
    if (openMenu === null) return;
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu, close]);

  return (
    <div className={styles.menuBar} ref={barRef}>
      {MENUS.map((menu, i) => (
        <div key={menu.label} className={styles.menuContainer}>
          <span
            className={`${styles.menuItem} ${openMenu === i ? styles.menuItemActive : ""}`}
            onMouseDown={() => setOpenMenu(openMenu === i ? null : i)}
            onMouseEnter={() => { if (openMenu !== null) setOpenMenu(i); }}
          >
            {menu.label}
          </span>
          {openMenu === i && (
            <div className={styles.dropdown}>
              {menu.items.map((item, j) =>
                item.separator ? (
                  <div key={j} className={styles.separator} />
                ) : (
                  <div
                    key={j}
                    className={styles.dropdownItem}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      close();
                      if (item.action && actions[item.action]) {
                        (actions[item.action] as () => void)();
                      }
                    }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && <span className={styles.shortcut}>{item.shortcut}</span>}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
