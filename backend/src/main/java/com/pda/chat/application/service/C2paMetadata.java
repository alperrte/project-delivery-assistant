package com.pda.chat.application.service;

import org.apache.pdfbox.cos.*;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.zip.InflaterInputStream;

/** Recognizes bounded C2PA manifest-store metadata, never arbitrary embedded documents or executable payloads. */
final class C2paMetadata {
    private static final int LIMIT=2097152;
    private static final byte[] STORE_UUID=java.util.HexFormat.of().parseHex("6332706100110010800000aa00389b71");
    private static final Set<String> LEAVES=Set.of("jumd","cbor","json","xml ","uuid","bfdb","bidb","free","brob");

    static int inspect(COSStream stream) throws java.io.IOException {
        String mime=stream.getNameAsString(COSName.SUBTYPE);
        if(!"application/c2pa".equals(mime)&&!"application/x-c2pa-manifest-store".equals(mime))throw invalid();
        COSBase filter=stream.getDictionaryObject(COSName.FILTER);
        if(filter instanceof COSArray array&&array.size()==1)filter=array.getObject(0);
        boolean compressed=filter instanceof COSName name&&(name.getName().equals("FlateDecode")||name.getName().equals("Fl"));
        if(filter!=null&&filter!=COSNull.NULL&&!compressed)throw invalid();
        COSBase parameters=stream.getDictionaryObject(COSName.DECODE_PARMS);
        if(parameters instanceof COSArray array&&array.size()==1)parameters=array.getObject(0);
        if(parameters!=null&&parameters!=COSNull.NULL&&(!(parameters instanceof COSDictionary dictionary)||dictionary.getInt(COSName.PREDICTOR,1)!=1))throw invalid();
        byte[] bytes;
        // Use a streaming inflater so the decoded size is bounded before allocating the complete metadata.
        try(InputStream raw=stream.createRawInputStream();InputStream input=compressed?new InflaterInputStream(raw):raw) {
            bytes=input.readNBytes(LIMIT+1);
        }
        if(bytes.length>LIMIT||bytes.length<38)throw invalid();
        var parser=new Boxes(bytes);
        var root=parser.box(0,bytes.length);
        if(!root.type().equals("jumb")||root.end()!=bytes.length)throw invalid();
        var description=parser.box(root.body(),root.end());
        if(!description.type().equals("jumd")||description.end()-description.body()<22)throw invalid();
        for(int i=0;i<STORE_UUID.length;i++)if(bytes[description.body()+i]!=STORE_UUID[i])throw invalid();
        int label=description.body()+17;
        if((bytes[description.body()+16]&2)==0||label+5>description.end()||bytes[label]!='c'||bytes[label+1]!='2'||bytes[label+2]!='p'||bytes[label+3]!='a'||bytes[label+4]!=0)throw invalid();
        parser.children(root.body(),root.end(),0);
        return bytes.length;
    }
    private record Box(String type,int body,int end){}
    private static final class Boxes {
        final byte[] bytes;final ByteBuffer data;int count;
        Boxes(byte[] bytes){this.bytes=bytes;this.data=ByteBuffer.wrap(bytes);}
        Box box(int start,int end) {
            if(end-start<8||++count>10000)throw invalid();
            long size=Integer.toUnsignedLong(data.getInt(start));int header=8;
            if(size==1){if(end-start<16)throw invalid();size=data.getLong(start+8);header=16;}
            if(size<header||size>end-start)throw invalid();
            return new Box(new String(bytes,start+4,4,StandardCharsets.US_ASCII),start+header,start+(int)size);
        }
        void children(int start,int end,int depth) {
            if(depth>32)throw invalid();boolean first=true;
            for(int offset=start;offset<end;) {
                var box=box(offset,end);
                if(first&&!box.type().equals("jumd"))throw invalid();
                first=false;
                if(box.type().equals("jumb"))children(box.body(),box.end(),depth+1);
                else if(!LEAVES.contains(box.type()))throw invalid();
                offset=box.end();
            }
            if(first)throw invalid();
        }
    }
    private static IllegalArgumentException invalid(){return new IllegalArgumentException("Invalid provenance metadata");}
}
