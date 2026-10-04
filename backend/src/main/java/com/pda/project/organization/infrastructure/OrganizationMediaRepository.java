package com.pda.project.organization.infrastructure;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.util.*;
@Repository
public class OrganizationMediaRepository {
    public record ObjectRecord(String key,UUID organizationId,String kind,String type,int size,String state) {}
    private final JdbcTemplate jdbc;
    public OrganizationMediaRepository(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public void pending(String key,UUID id,String kind,String type,int size){
        jdbc.update("INSERT INTO organization_media_objects (object_key,organization_id,kind,content_type,size_bytes,state,created_at,lease_until) VALUES(?,?,?,?,?,'PENDING',now(),now()+interval '5 minutes')",key,id,kind,type,size);
    }
    public ObjectRecord lock(String key){
        return jdbc.query("SELECT * FROM organization_media_objects WHERE object_key=? FOR UPDATE",(r,n)->new ObjectRecord(r.getString("object_key"),r.getObject("organization_id",UUID.class),r.getString("kind"),r.getString("content_type"),r.getInt("size_bytes"),r.getString("state")),key).stream().findFirst().orElseThrow();
    }
    public ObjectRecord read(String key){
        return jdbc.query("SELECT * FROM organization_media_objects WHERE object_key=? AND state='ACTIVE'",(r,n)->new ObjectRecord(r.getString("object_key"),r.getObject("organization_id",UUID.class),r.getString("kind"),r.getString("content_type"),r.getInt("size_bytes"),r.getString("state")),key).stream().findFirst().orElseThrow();
    }
    public void activate(String key){jdbc.update("UPDATE organization_media_objects SET state='ACTIVE' WHERE object_key=?",key);}
    public void retire(String key){if(key!=null) jdbc.update("UPDATE organization_media_objects SET state='DELETE_PENDING' WHERE object_key=?",key);}
    public List<String> cleanupCandidates(){return jdbc.queryForList("SELECT object_key FROM organization_media_objects WHERE state='DELETE_PENDING' OR (state='PENDING' AND lease_until<now()) ORDER BY created_at LIMIT 50",String.class);}
    public boolean claimCleanup(String key){return !jdbc.queryForList("SELECT object_key FROM organization_media_objects WHERE object_key=? AND (state='DELETE_PENDING' OR (state='PENDING' AND lease_until<now())) FOR UPDATE SKIP LOCKED",String.class,key).isEmpty();}
    public boolean referenced(String key){return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM organizations WHERE logo_key=? OR cover_image_key=?)",Boolean.class,key,key));}
    public void deleted(String key){jdbc.update("DELETE FROM organization_media_objects WHERE object_key=?",key);}
}
