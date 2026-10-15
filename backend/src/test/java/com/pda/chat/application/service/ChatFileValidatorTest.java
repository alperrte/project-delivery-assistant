package com.pda.chat.application.service;
import org.junit.jupiter.api.Test;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipOutputStream;
import java.util.zip.ZipEntry;
import static org.junit.jupiter.api.Assertions.*;
class ChatFileValidatorTest {
 @Test void markdownFilesAcceptUtf8AsPlainTextAndOnlyKnownMarkdownMimeAliases() {
  byte[] text="\uFEFF# Örnek\r\n\tUnicode: ✓\n<script>example only</script>\n".getBytes(StandardCharsets.UTF_8);
  for(String name:new String[]{".md","README.md","NOTES.MD"})
   for(String mime:new String[]{null,""," ","text/plain","text/plain; charset=UTF-8","application/octet-stream","binary/octet-stream","text/markdown","text/x-markdown; charset=UTF-8"})
    assertEquals("text/plain",ChatFileValidator.inspect(text,name,mime));
  for(String mime:new String[]{"text/html","application/pdf","text/anything"})
   assertThrows(com.pda.chat.domain.ChatException.class,()->ChatFileValidator.inspect(text,"README.md",mime));
  for(String name:new String[]{"md","README.md.exe","README.markdown"})
   assertThrows(com.pda.chat.domain.ChatException.class,()->ChatFileValidator.inspect(text,name,"text/plain"));
  for(String mime:new String[]{"text/markdown","text/x-markdown"})
   assertThrows(com.pda.chat.domain.ChatException.class,()->ChatFileValidator.inspect(text,".env",mime));
 }
 @Test void envFilesAcceptUtf8TextWithOnlyExplicitOrGenericMimeTypes() {
  byte[] text="\uFEFF# Example only\r\nAPP_LABEL=Örnek\nAPP_MODE=demo\t\n".getBytes(StandardCharsets.UTF_8);
  for(String name:new String[]{".env","example.env","EXAMPLE.ENV"}) {
   for(String mime:new String[]{null,""," ","text/plain","text/plain; charset=UTF-8","application/octet-stream","binary/octet-stream"}) {
    assertEquals("text/plain",ChatFileValidator.inspect(text,name,mime));
   }
  }
  assertThrows(com.pda.chat.domain.ChatException.class,()->ChatFileValidator.inspect(text,".env","application/pdf"));
  assertThrows(com.pda.chat.domain.ChatException.class,()->ChatFileValidator.inspect(text,".env","text/html"));
  for(String name:new String[]{"env",".env.dev",".env.prod","example.txt","example.env.exe"})
   assertThrows(com.pda.chat.domain.ChatException.class,()->ChatFileValidator.inspect(text,name,"text/plain"));
 }
 @Test void textFilesRejectMalformedUtf8BinaryControlsEmptyAndOversizeContent() {
  for(byte[] invalid:new byte[][]{new byte[0],new byte[2097153],{(byte)0xc3,0x28},{(byte)0xc3},{(byte)0xff,(byte)0xfe,0x41,0},"APP_MODE=demo\0".getBytes(StandardCharsets.UTF_8),"APP_MODE=demo\u007f".getBytes(StandardCharsets.UTF_8),"APP_MODE=demo\u0085".getBytes(StandardCharsets.UTF_8)})
   for(String name:new String[]{".env","README.md"})
    assertThrows(com.pda.chat.domain.ChatException.class,()->ChatFileValidator.inspect(invalid,name,"text/plain"));
 }
 @Test void realImageAndContentTypeMustMatchAndNamesCannotInjectHeaders() {
  byte[] png=java.util.Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==");
  assertEquals("image/png",ChatFileValidator.inspect(png,"photo.png","image/png"));
  assertThrows(RuntimeException.class,()->ChatFileValidator.inspect(png,"photo.jpg","image/jpeg"));
  assertThrows(RuntimeException.class,()->ChatFileValidator.inspect(png,"photo.png","application/pdf"));
  assertEquals("photo.png",ChatFileValidator.filename("../../photo.png"));
  assertThrows(RuntimeException.class,()->ChatFileValidator.filename("test\r\nHeader: value.pdf"));
  assertThrows(RuntimeException.class,()->ChatFileValidator.inspect(new byte[2097153],"huge.pdf","application/pdf"));
 }
 @Test void docxStructureMustExistAndMacrosExternalRelationshipsAndTraversalAreRejected() throws Exception {
  assertEquals("application/vnd.openxmlformats-officedocument.wordprocessingml.document",ChatFileValidator.inspect(docx("word/document.xml","<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body/></w:document>"),"test.docx",null));
  assertThrows(RuntimeException.class,()->ChatFileValidator.inspect(docx("word/vbaProject.bin","anything"),"bad.docx",null));
  assertThrows(RuntimeException.class,()->ChatFileValidator.inspect(docx("../word/document.xml","<document/>"),"bad.docx",null));
  assertThrows(RuntimeException.class,()->ChatFileValidator.inspect(docx("word/_rels/document.xml.rels","<Relationships><Relationship TargetMode=\"External\" Target=\"file:///private\"/></Relationships>"),"bad.docx",null));
  assertThrows(RuntimeException.class,()->ChatFileValidator.inspect(docx("word/document.xml","<!DOCTYPE x [<!ENTITY y SYSTEM 'file:///private'>]><document>&y;</document>"),"bad.docx",null));
 }
 private byte[] docx(String name,String value) throws Exception {
  var bytes=new ByteArrayOutputStream();try(var zip=new ZipOutputStream(bytes)) {
   for(var pair:new String[][]{{"[Content_Types].xml","<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/></Types>"},{name,value}}){zip.putNextEntry(new ZipEntry(pair[0]));zip.write(pair[1].getBytes(StandardCharsets.UTF_8));zip.closeEntry();}
   if(!name.equals("word/document.xml")){zip.putNextEntry(new ZipEntry("word/document.xml"));zip.write("<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body/></w:document>".getBytes(StandardCharsets.UTF_8));zip.closeEntry();}
  }return bytes.toByteArray();
 }
 @Test void ordinaryPdfPageDestinationsAndLiteralSecurityWordsAreNotRejected() throws Exception {
  var bytes=new ByteArrayOutputStream();try(var pdf=new org.apache.pdfbox.pdmodel.PDDocument()) {
   var page=new org.apache.pdfbox.pdmodel.PDPage();pdf.addPage(page);
   var destination=new org.apache.pdfbox.cos.COSArray();destination.add(page.getCOSObject());destination.add(org.apache.pdfbox.cos.COSName.getPDFName("Fit"));
   pdf.getDocumentCatalog().getCOSObject().setItem(org.apache.pdfbox.cos.COSName.getPDFName("OpenAction"),destination);
   pdf.getDocumentInformation().setCustomMetadataValue("Notes","Examples: /JavaScript /OpenAction /Launch");pdf.save(bytes);
  }
  assertEquals("application/pdf",ChatFileValidator.inspect(bytes.toByteArray(),"cv.pdf","application/pdf; charset=binary"));
 }
 @Test void wordWebAndEmailHyperlinksAreAcceptedButExternalResourcesAndScriptLinksAreNot() throws Exception {
  for(String link:new String[]{"https://example.com/cv","mailto:member@example.test","tel:+905551234567"}) {
   String rel="<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink\" TargetMode=\"External\" Target=\""+link+"\"/></Relationships>";
   assertEquals("application/vnd.openxmlformats-officedocument.wordprocessingml.document",ChatFileValidator.inspect(docx("word/_rels/document.xml.rels",rel),"cv.docx","application/zip"));
  }
  String unsafe="<Relationships><Relationship Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink\" TargetMode=\"External\" Target=\"javascript:alert(1)\"/></Relationships>";
  assertThrows(RuntimeException.class,()->ChatFileValidator.inspect(docx("word/_rels/document.xml.rels",unsafe),"bad.docx",null));
 }
 @Test void validPdfAndLegacyWordAreAcceptedWhileWordEncryptionIsRejected() throws Exception {
  var bytes=new ByteArrayOutputStream();try(var pdf=new org.apache.pdfbox.pdmodel.PDDocument()){pdf.addPage(new org.apache.pdfbox.pdmodel.PDPage());pdf.save(bytes);}
  assertEquals("application/pdf",ChatFileValidator.inspect(bytes.toByteArray(),"document.pdf","application/pdf"));
  assertEquals("application/msword",ChatFileValidator.inspect(word(),"document.doc","application/msword"));
  byte[] encrypted=word();encrypted[3*512+11]=1;
  assertThrows(RuntimeException.class,()->ChatFileValidator.inspect(encrypted,"document.doc",null));
  assertThrows(RuntimeException.class,()->ChatFileValidator.inspect("%PDF-1.7 startxref 0 %%EOF".getBytes(),"fake.pdf",null));
 }
 private byte[] word() {
  byte[] bytes=new byte[19*512];var data=java.nio.ByteBuffer.wrap(bytes).order(java.nio.ByteOrder.LITTLE_ENDIAN);
  data.put(new byte[]{(byte)0xd0,(byte)0xcf,0x11,(byte)0xe0,(byte)0xa1,(byte)0xb1,0x1a,(byte)0xe1});
  data.putShort(26,(short)3);data.putShort(28,(short)0xfffe);data.putShort(30,(short)9);data.putShort(32,(short)6);
  data.putInt(44,1);data.putInt(48,0);data.putInt(56,4096);data.putInt(60,-2);data.putInt(68,-2);
  for(int i=0;i<109;i++)data.putInt(76+i*4,-1);data.putInt(76,1);
  String[] names={"Root Entry","WordDocument","1Table"};int[] starts={-2,2,10};
  for(int i=0;i<3;i++){int offset=512+i*128;byte[] name=(names[i]+"\0").getBytes(StandardCharsets.UTF_16LE);System.arraycopy(name,0,bytes,offset,name.length);data.putShort(offset+64,(short)name.length);bytes[offset+66]=(byte)(i==0?5:2);data.putInt(offset+116,starts[i]);data.putLong(offset+120,i==0?0:4096);}
  for(int i=0;i<128;i++)data.putInt(1024+4*i,-1);data.putInt(1024,-2);data.putInt(1028,-3);
  for(int i=2;i<18;i++)data.putInt(1024+i*4,(i==9||i==17)?-2:i+1);
  data.putShort(1536,(short)0xa5ec);data.putShort(1538,(short)0xc1);return bytes;
 }
 @Test void activePdfActionsAndFakeWordHeadersAreRejected() {
  assertThrows(RuntimeException.class,()->ChatFileValidator.inspect("%PDF-1.7\n/JavaScript (evil)\nstartxref\n0\n%%EOF".getBytes(StandardCharsets.ISO_8859_1),"bad.pdf",null));
  assertThrows(RuntimeException.class,()->ChatFileValidator.inspect(new byte[512],"fake.doc",null));
 }
}
