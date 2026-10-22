# Brings up the loopback interface inside a fresh network namespace (used by scripts/offline-run.sh).
import fcntl, socket, struct
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
SIOCGIFFLAGS, SIOCSIFFLAGS, IFF_UP = 0x8913, 0x8914, 0x1
ifr = struct.pack('16sH', b'lo', 0)
flags = struct.unpack('16sH', fcntl.ioctl(s, SIOCGIFFLAGS, ifr))[1]
fcntl.ioctl(s, SIOCSIFFLAGS, struct.pack('16sH', b'lo', flags | IFF_UP))
print('lo up')
