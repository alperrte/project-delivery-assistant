package com.pda.chat.application.service;

import com.pda.chat.domain.ChatException;
import com.pda.shared.ImageSniffer;
import java.io.ByteArrayInputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.HashSet;
import java.util.zip.ZipInputStream;
import javax.xml.parsers.DocumentBuilderFactory;

/** Strict allowlist, bounded container parsing and safe display names. No client path selects a storage object. */
final class ChatFileValidator {
    static String filename(String raw) {
        if (raw == null) throw invalid();
        String name = raw.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).strip();
        if (name.isBlank() || name.length() > 180 || name.codePoints().anyMatch(c -> Character.isISOControl(c)
                || Character.getType(c) == Character.FORMAT)) throw invalid();
        return name;
    }

    static String inspect(byte[] bytes, String name, String claimed) {
        if(bytes.length == 0 || bytes.length > 2097152) throw invalid();
        String extension = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        String type;
        try {
            type = switch (extension) {
                case "png", "jpg", "jpeg", "webp" -> {
                    String detected = ImageSniffer.inspect(bytes).contentType();
                    String expected = switch(extension) {case "png" -> "image/png"; case "webp" -> "image/webp"; default -> "image/jpeg";};
                    if (!expected.equals(detected)) throw invalid();
                    yield detected;
                }
                case "pdf" -> { pdf(bytes); yield "application/pdf"; }
                case "docx" -> { docx(bytes); yield "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; }
                case "doc" -> { LegacyWordInspector.inspect(bytes); yield "application/msword"; }
                case "env", "md" -> {
                    if (!name.toLowerCase(Locale.ROOT).endsWith("." + extension)) throw invalid();
                    text(bytes); yield "text/plain";
                }
                default -> throw invalid();
            };
        } catch (ImageSniffer.RejectedImageException e) { throw invalid(); }
        if (claimed != null && !claimed.isBlank()) {
            String mime=claimed.split(";",2)[0].strip().toLowerCase(Locale.ROOT);
            boolean generic=mime.equals("application/octet-stream")||mime.equals("binary/octet-stream");
            boolean alias=switch(extension) {
                case "pdf" -> mime.equals("application/x-pdf");
                case "docx" -> mime.equals("application/zip")||mime.equals("application/x-zip-compressed")||mime.equals("application/vnd.ms-word.document.12");
                case "doc" -> mime.equals("application/x-ole-storage")||mime.equals("application/vnd.ms-word");
                case "md" -> mime.equals("text/markdown")||mime.equals("text/x-markdown");
                default -> false;
            };
            if(!mime.equals(type)&&!generic&&!alias)throw invalid();
        }
        return type;
    }

    private static void text(byte[] bytes) {
        try {
            String text = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(bytes)).toString();
            if (text.codePoints().anyMatch(c -> Character.isISOControl(c) && c != '\r' && c != '\n' && c != '\t'))
                throw invalid();
        } catch (CharacterCodingException e) {
            throw invalid();
        }
    }

    private static void pdf(byte[] data) {
        String text = new String(data, StandardCharsets.ISO_8859_1);
        int header=text.indexOf("%PDF-");
        if(header<0||header>1023)throw invalid();
        // Inspect parsed objects, not raw text: normal page destinations and words in document text are not scripts.
        try(var pdf=org.apache.pdfbox.Loader.loadPDF(data)) {
            if(pdf.isEncrypted()||pdf.getNumberOfPages()<1||pdf.getNumberOfPages()>1000)throw invalid();
            var seen=java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<org.apache.pdfbox.cos.COSBase,Boolean>());
            var metadata=java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<org.apache.pdfbox.cos.COSStream,Boolean>());
            int metadataBytes=0;
            var pending=new java.util.ArrayDeque<org.apache.pdfbox.cos.COSBase>();pending.push(pdf.getDocumentCatalog().getCOSObject());
            while(!pending.isEmpty()) {
                var object=pending.pop();if(!seen.add(object))continue;if(seen.size()>20000)throw invalid();
                if(object instanceof org.apache.pdfbox.cos.COSObject reference) {if(reference.getObject()!=null)pending.push(reference.getObject());}
                else if(object instanceof org.apache.pdfbox.cos.COSDictionary dictionary) {
                    if(object instanceof org.apache.pdfbox.cos.COSStream stream&&"EmbeddedFile".equals(stream.getNameAsString(org.apache.pdfbox.cos.COSName.TYPE))&&metadata.add(stream)) {
                        metadataBytes+=C2paMetadata.inspect(stream);if(metadataBytes>2097152)throw invalid();
                    }
                    if("Filespec".equals(dictionary.getNameAsString(org.apache.pdfbox.cos.COSName.TYPE))
                            &&(!(dictionary.getDictionaryObject(org.apache.pdfbox.cos.COSName.EF) instanceof org.apache.pdfbox.cos.COSDictionary)||dictionary.containsKey(org.apache.pdfbox.cos.COSName.FS)))throw invalid();
                    for(var key:dictionary.keySet()) {
                        if(java.util.Set.of("JS","JavaScript","AA","XFA","RichMediaContent").contains(key.getName()))throw invalid();
                        var value=dictionary.getDictionaryObject(key);
                        if(key.getName().equals("EF")) {
                            if(!(value instanceof org.apache.pdfbox.cos.COSDictionary files)||files.size()==0)throw invalid();
                            for(var name:files.keySet()) {
                                if(!(files.getDictionaryObject(name) instanceof org.apache.pdfbox.cos.COSStream stream))throw invalid();
                                if(metadata.add(stream)){metadataBytes+=C2paMetadata.inspect(stream);if(metadataBytes>2097152)throw invalid();}
                            }
                        }
                        if(key.getName().equals("OpenAction")&&!safePdfDestination(value))throw invalid();
                        if(key.getName().equals("S")&&value instanceof org.apache.pdfbox.cos.COSName action&&java.util.Set.of("Launch","JavaScript","GoToR","GoToE","SubmitForm","ImportData","Rendition").contains(action.getName()))throw invalid();
                        if(key.getName().equals("URI")&&(!(value instanceof org.apache.pdfbox.cos.COSString link)||!safeLink(link.getString())))throw invalid();
                        if(value!=null)pending.push(value);
                    }
                } else if(object instanceof org.apache.pdfbox.cos.COSArray array) {for(int i=0;i<array.size();i++){var value=array.getObject(i);if(value!=null)pending.push(value);}}
            }
        }catch(Exception e){throw invalid();}
    }

    private static boolean safePdfDestination(org.apache.pdfbox.cos.COSBase value) {
        if(value instanceof org.apache.pdfbox.cos.COSArray || value instanceof org.apache.pdfbox.cos.COSName || value instanceof org.apache.pdfbox.cos.COSString)return true;
        if(value instanceof org.apache.pdfbox.cos.COSDictionary action) {
            var kind=action.getDictionaryObject(org.apache.pdfbox.cos.COSName.getPDFName("S"));
            var destination=action.getDictionaryObject(org.apache.pdfbox.cos.COSName.getPDFName("D"));
            return kind instanceof org.apache.pdfbox.cos.COSName name && name.getName().equals("GoTo")
                    && (destination instanceof org.apache.pdfbox.cos.COSArray || destination instanceof org.apache.pdfbox.cos.COSName || destination instanceof org.apache.pdfbox.cos.COSString);
        }
        return false;
    }

    private static boolean safeLink(String target) {
        if(target==null||target.isBlank()||target.length()>2048||target.codePoints().anyMatch(c->Character.isISOControl(c)||Character.getType(c)==Character.FORMAT))return false;
        try {
            var uri=java.net.URI.create(target.replace(" ","%20"));
            if(uri.getScheme()==null||uri.getSchemeSpecificPart()==null||uri.getSchemeSpecificPart().isBlank()
                    ||uri.getSchemeSpecificPart().codePoints().anyMatch(Character::isISOControl))return false;
            return switch(uri.getScheme().toLowerCase(Locale.ROOT)) {
                case "http","https" -> uri.getHost()!=null&&uri.getUserInfo()==null;
                case "mailto","tel" -> uri.isOpaque();
                default -> false;
            };
        }catch(IllegalArgumentException error){return false;}
    }

    private static void docx(byte[] bytes) {
        int total=0,count=0; boolean document=false,types=false;var names=new HashSet<String>();
        try (var zip=new ZipInputStream(new ByteArrayInputStream(bytes))) {
            for(var entry=zip.getNextEntry();entry!=null;entry=zip.getNextEntry()) {
                String name=entry.getName();String lower=name.toLowerCase(Locale.ROOT);
                if(++count>200 || !names.add(name) || name.startsWith("/") || name.contains("..") || name.contains("\\")
                        || lower.contains("vbaproject") || lower.contains("embeddings/") || lower.contains("activex/")) throw invalid();
                byte[] content=zip.readNBytes(8*1024*1024+1);total+=content.length;
                if(total>8*1024*1024)throw invalid();
                if(name.equals("word/document.xml"))document=true;
                if(name.equals("[Content_Types].xml"))types=true;
                if(name.endsWith(".xml")||name.endsWith(".rels")) {
                    var factory=DocumentBuilderFactory.newInstance();
                    factory.setNamespaceAware(true);
                    factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl",true);
                    factory.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_DTD, "");
                    factory.setAttribute(javax.xml.XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
                    factory.setExpandEntityReferences(false);
                    var builder=factory.newDocumentBuilder();
                    builder.setErrorHandler(new org.xml.sax.helpers.DefaultHandler() {
                        @Override public void error(org.xml.sax.SAXParseException e) throws org.xml.sax.SAXException { throw e; }
                        @Override public void fatalError(org.xml.sax.SAXParseException e) throws org.xml.sax.SAXException { throw e; }
                    });
                    var xml=builder.parse(new ByteArrayInputStream(content));
                    if(name.equals("word/document.xml")) {
                        var root=xml.getDocumentElement();
                        if(!"document".equals(root.getLocalName()) || !java.util.Set.of("http://schemas.openxmlformats.org/wordprocessingml/2006/main","http://purl.oclc.org/ooxml/wordprocessingml/main").contains(root.getNamespaceURI()))throw invalid();
                    }
                    if(name.equals("[Content_Types].xml")) {
                        boolean main=false;var overrides=xml.getElementsByTagNameNS("http://schemas.openxmlformats.org/package/2006/content-types","Override");
                        for(int i=0;i<overrides.getLength();i++){var node=(org.w3c.dom.Element)overrides.item(i);if("/word/document.xml".equals(node.getAttribute("PartName")) && "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml".equals(node.getAttribute("ContentType")))main=true;}
                        if(!main)throw invalid();
                    }
                    var relationships=xml.getElementsByTagNameNS("*","Relationship");
                    for(int i=0;i<relationships.getLength();i++) {
                        var attrs=relationships.item(i).getAttributes();
                        var mode=attrs.getNamedItem("TargetMode");
                        if(mode!=null&&mode.getNodeValue().equalsIgnoreCase("External")) {
                            var relationType=attrs.getNamedItem("Type");var target=attrs.getNamedItem("Target");
                            if(relationType==null||target==null||!java.util.Set.of("http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink","http://purl.oclc.org/ooxml/officeDocument/relationships/hyperlink").contains(relationType.getNodeValue())||!safeLink(target.getNodeValue()))throw invalid();
                        }
                    }
                    if(name.equals("[Content_Types].xml")) {
                        var entries=xml.getDocumentElement().getChildNodes();
                        for(int i=0;i<entries.getLength();i++)if(entries.item(i) instanceof org.w3c.dom.Element part&&part.getAttribute("ContentType").toLowerCase(Locale.ROOT).contains("macroenabled"))throw invalid();
                    }
                }
            }
            if(!document||!types)throw invalid();
        } catch(Exception e) {throw invalid();}
    }

    private static ChatException invalid(){return ChatException.invalid("CHAT_ATTACHMENT_INVALID");}
}
