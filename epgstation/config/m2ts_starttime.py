import bitstring
import math
import sys
import datetime

packet_size = 188
mjdbasedate = 40587

class Packet:
    def __init__(self, binary):
        self.binary = binary

    def unpack(self):
        self.sync, self.error, self.pid, self.adapt_ctrl, self.pointer, self.payload = \
            self.binary.unpack('uint:8, bool, pad:2, uint:13, pad:2, uint:2, pad:4, uint:8, bits:1432, pad:4')
        if self.sync != 0x47:
            return False
        return True

    def get_TDT_timestamp(self):
        mjd16, h1, h2, m1, m2, s1, s2 = \
            self.payload.unpack('pad:8, pad:16, uint:16, uint:4, uint:4, uint:4, uint:4, uint:4, uint:4')
        hour = h1 * 10 + h2
        min = m1 * 10 + m2
        sec = s1 * 10 + s2
        unixtime = (mjd16 - mjdbasedate) * 24 * 60 * 60 + \
            hour * 60 * 60 + min * 60 + sec - 9 * 60 * 60
        return unixtime

    def is_pcr(self):
        pcr_f, opcr_f, splicing_f, private_f, ext_f, self.adapt_opt = \
            self.payload.unpack('pad:3, bool, bool, bool, bool, bool, bits:1424')
        return pcr_f

    def pcr_unpack(self):
        base, reserved, ext = self.adapt_opt.unpack('bits:33, uint:6, uint:9')
        pcr = base.uint * 300 + ext
        sec = pcr / 27000000
        # print(sec)
        return sec

def getStartTime(f):
    firstpcr = 0 
    lastpcr = 0
    while True:
        try:
            packet = f.read(packet_size * 8)  # bit
        except bitstring.ReadError:  # 終端
            break
        ts = Packet(packet)
        if ts.unpack():
            # PCR
            if ts.adapt_ctrl >> 1 == 1 and ts.is_pcr() and not ts.error:
                pcr = ts.pcr_unpack()
                if firstpcr == 0:
                    firstpcr = pcr
                if (abs(pcr - firstpcr) < 10):
                    lastpcr = pcr
            # TDT
            if ts.pid == 0x14 and not ts.error:
                date = ts.get_TDT_timestamp()
                diff = abs(lastpcr - firstpcr)
                start_time = round(date - diff if diff < 10 else 0)
                return start_time
        else:
            if ts.packet.bytepos != 0:
                f.bytepos = f.bytepos - packet_size + ts.packet.bytepos

if __name__ == '__main__':
    filename = sys.argv[1]
    f = bitstring.ConstBitStream(filename=filename)
    print(getStartTime(f))
    # print(datetime.datetime.fromtimestamp(getStartTime(f), datetime.timezone.utc))
