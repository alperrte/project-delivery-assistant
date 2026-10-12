package com.pda.chat.application.service;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import com.pda.chat.domain.ChatException;

/** Bounded compound-file directory and Word FIB inspection, without running or rendering Office content. */
final class LegacyWordInspector {
    static void inspect(byte[] bytes) {
        try { new Reader(bytes).inspect(); } catch (RuntimeException error) { throw ChatException.invalid("CHAT_ATTACHMENT_INVALID"); }
    }
    private static final class Reader {
        private final byte[] bytes;
        private final ByteBuffer data;
        private final int sector;
        private final int[] fat;
        Reader(byte[] bytes) {
            this.bytes=bytes; data=ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
            byte[] signature={(byte)0xd0,(byte)0xcf,0x11,(byte)0xe0,(byte)0xa1,(byte)0xb1,0x1a,(byte)0xe1};
            if(bytes.length<512||!Arrays.equals(signature,Arrays.copyOf(bytes,8))||data.getShort(28)!=(short)0xfffe)throw invalid();
            int shift=Short.toUnsignedInt(data.getShort(30));if(shift!=9&&shift!=12)throw invalid();sector=1<<shift;
            if(bytes.length%sector!=0||data.getInt(56)!=4096||data.getShort(32)!=6)throw invalid();
            int count=data.getInt(44);if(count<1||count>64||data.getInt(72)!=0)throw invalid();
            fat=new int[count*sector/4];var seen=new HashSet<Integer>();
            for(int i=0;i<count;i++){int id=data.getInt(76+4*i);if(!seen.add(id))throw invalid();int offset=offset(id);for(int n=0;n<sector/4;n++)fat[i*sector/4+n]=data.getInt(offset+4*n);}
        }
        int offset(int id){long offset=((long)id+1)*sector;if(id<0||offset+sector>bytes.length)throw invalid();return (int)offset;}
        byte[] chain(int id) {
            var out=new java.io.ByteArrayOutputStream();var seen=new HashSet<Integer>();
            while(id!=-2){if(id<0||id>=fat.length||!seen.add(id)||seen.size()>bytes.length/sector)throw invalid();int offset=offset(id);out.write(bytes,offset,sector);id=fat[id];}
            return out.toByteArray();
        }
        record Entry(String name,int kind,int start,long size){}
        void inspect() {
            byte[] directory=chain(data.getInt(48));var dir=ByteBuffer.wrap(directory).order(ByteOrder.LITTLE_ENDIAN);
            Entry root=null,word=null;boolean table=false;
            for(int i=0;i+128<=directory.length;i+=128){int kind=directory[i+66]&255;if(kind==0)continue;
                int length=Short.toUnsignedInt(dir.getShort(i+64));if(length<2||length>64||length%2!=0)throw invalid();
                var name=new String(directory,i,length-2,StandardCharsets.UTF_16LE);String lower=name.toLowerCase(Locale.ROOT);
                if(lower.contains("vba")||lower.contains("macro")||lower.contains("objectpool")||lower.contains("encrypted"))throw invalid();
                var entry=new Entry(name,kind,dir.getInt(i+116),dir.getLong(i+120));if(entry.size()<0||entry.size()>bytes.length)throw invalid();
                if(kind==5)root=entry;if(kind==2&&name.equals("WordDocument"))word=entry;
                if(kind==2&&(name.equals("0Table")||name.equals("1Table")))table=true;
            }
            if(root==null||word==null||!table||word.size()<32)throw invalid();
            byte[] stream;
            if(word.size()>=4096)stream=chain(word.start());else{
                byte[] minis=chain(data.getInt(60)),pool=chain(root.start());var mf=ByteBuffer.wrap(minis).order(ByteOrder.LITTLE_ENDIAN);
                var out=new java.io.ByteArrayOutputStream();var seen=new HashSet<Integer>();int id=word.start();
                while(id!=-2){if(id<0||id>=minis.length/4||((long)id+1)*64>pool.length||!seen.add(id))throw invalid();out.write(pool,id*64,64);id=mf.getInt(id*4);}
                stream=out.toByteArray();
            }
            if(stream.length<word.size())throw invalid();var fib=ByteBuffer.wrap(stream).order(ByteOrder.LITTLE_ENDIAN);
            if(fib.getShort(0)!=(short)0xa5ec||Short.toUnsignedInt(fib.getShort(2))<0x65||(fib.getShort(10)&0x8100)!=0)throw invalid();
        }
        IllegalArgumentException invalid(){return new IllegalArgumentException("Invalid compound document");}
    }
}
