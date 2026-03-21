f = 'src/components/rooms/RoomSettingsPanel.tsx'
with open(f, 'r', encoding='latin-1') as fh:
    c = fh.read()
c = c.replace('?? Encrypted (Megolm)', '\U0001f512 Encrypted (Megolm)')
c = c.replace('?? Not Encrypted', '\U0001f513 Not Encrypted')
with open(f, 'w', encoding='utf-8') as fh:
    fh.write(c)
print('Fixed')
