import os

replacements = [
    ('src/components/rooms/CreateRoomDialog.tsx', '"?? New Message"', '"✉️ New Message"'),
    ('src/components/rooms/CreateRoomDialog.tsx', '"?? Create Chat Room"', '"💬 Create Chat Room"'),
    ('src/components/rooms/CreateRoomDialog.tsx', '?? Encrypted', '🔒 Encrypted'),
    ('src/components/rooms/JoinRoomDialog.tsx', '"?? Join Room"', '"🚪 Join Room"'),
    ('src/components/rooms/PendingInvitesDialog.tsx', '"?? Pending Invites"', '"📨 Pending Invites"'),
    ('src/components/rooms/RoomDirectoryDialog.tsx', '"?? Room Directory', '"🔍 Room Directory'),
    ('src/components/rooms/RoomDirectoryDialog.tsx', '? AOL Keyword"', '— AOL Keyword"'),
    ('src/components/rooms/RoomSettingsPanel.tsx', '"?? Room upgrade', '"⚠️ Room upgrade'),
    ('src/components/rooms/RoomSettingsPanel.tsx', '"?? Room Settings"', '"⚙️ Room Settings"'),
    ('src/components/rooms/RoomSettingsPanel.tsx', '"?? Encrypted (Megolm)"', '"🔒 Encrypted (Megolm)"'),
    ('src/components/rooms/RoomSettingsPanel.tsx', '"?? Not encrypted"', '"🔓 Not encrypted"'),
    ('src/components/security/IncomingVerificationDialog.tsx', '"?? Verification Request"', '"🔐 Verification Request"'),
    ('src/components/security/LockScreen.tsx', '"?? PufferChat Locked"', '"🔒 PufferChat Locked"'),
    ('src/components/settings/CacheSettings.tsx', '"??? Clear Cache"', '"🗑️ Clear Cache"'),
    ('src/components/common/EmptyStates.tsx', '"? Create Room"', '"➕ Create Room"'),
]

for fpath, old, new in replacements:
    fpath = fpath.replace('/', os.sep)
    if os.path.exists(fpath):
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read()
        except UnicodeDecodeError:
            with open(fpath, 'r', encoding='latin-1') as f:
                content = f.read()
        if old in content:
            content = content.replace(old, new)
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'Fixed: {fpath}')
        else:
            print(f'NOT FOUND in {fpath}: {repr(old[:40])}')
    else:
        print(f'MISSING: {fpath}')
