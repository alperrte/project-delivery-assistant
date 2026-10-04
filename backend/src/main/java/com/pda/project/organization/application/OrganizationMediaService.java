package com.pda.project.organization.application;
import com.pda.project.organization.domain.Organization;
import com.pda.project.organization.infrastructure.OrganizationMediaRepository;
import com.pda.project.organization.infrastructure.OrganizationRepository;
import com.pda.shared.ImageSniffer;
import com.pda.shared.MediaStorage;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.io.IOException;
import java.util.*;
@Service
public class OrganizationMediaService {
    public record StoredImage(String contentType,byte[] data){}
    private final OrganizationService organizations;
    private final OrganizationRepository repository;
    private final OrganizationMediaRepository objects;
    private final MediaStorage storage;
    private final TransactionTemplate tx;
    public OrganizationMediaService(OrganizationService organizations,OrganizationRepository repository,OrganizationMediaRepository objects,MediaStorage storage,PlatformTransactionManager manager){
        this.organizations=organizations;this.repository=repository;this.objects=objects;this.storage=storage;
        this.tx=new TransactionTemplate(manager);
        this.tx.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }
    public void authorize(UUID actor,UUID id){ organizations.detail(actor,id); }
    public void replace(UUID actor,UUID id,String kind,byte[] data){
        organizations.detail(actor,id); // Authorization before content inspection or filesystem IO.
        int limit="LOGO".equals(kind)?524288:2097152;
        if(data==null || data.length==0) throw invalid("EMPTY");
        if(data.length>limit) throw invalid("TOO_LARGE");
        ImageSniffer.Image image;
        try {image=ImageSniffer.inspect(data);} catch(ImageSniffer.RejectedImageException bad){throw invalid(bad.reason()==ImageSniffer.Reason.DIMENSIONS?"DIMENSIONS":"INVALID_TYPE");}
        String key=UUID.randomUUID().toString();
        tx.executeWithoutResult(status->{ organizations.lockedOwned(actor,id); objects.pending(key,id,kind,image.contentType(),data.length); });
        try {
            tx.executeWithoutResult(status->{
                var object=objects.lock(key);
                if(!"PENDING".equals(object.state())) throw invalid("CONFLICT");
                Organization org=organizations.lockedOwned(actor,id);
                try {storage.put(key,data);} catch(IOException failed){throw invalid("UNAVAILABLE");}
                String previous=org.mediaKey(kind);
                org.mediaStored(kind,key); repository.saveAndFlush(org);
                objects.activate(key); objects.retire(previous);
            });
        } catch(RuntimeException failed){
            tx.executeWithoutResult(status->objects.retire(key));
            cleanup(); throw failed;
        }
        cleanup();
    }
    public void remove(UUID actor,UUID id,String kind){
        tx.executeWithoutResult(status->{Organization org=organizations.lockedOwned(actor,id);String key=org.mediaKey(kind);
            org.mediaStored(kind,null);repository.saveAndFlush(org);objects.retire(key);});
        cleanup();
    }
    public StoredImage read(UUID actor,UUID id,String kind){
        // Keep the organization lock until the bytes are read, so replace/cleanup cannot race the response.
        return tx.execute(status->{Organization org=organizations.lockedOwned(actor,id);String key=org.mediaKey(kind);
            if(key==null) throw new NoSuchElementException();var object=objects.read(key);
            if(!object.organizationId().equals(id) || !object.kind().equals(kind)) throw invalid("UNAVAILABLE");
            try{return new StoredImage(object.type(),storage.read(key,object.size()));}catch(IOException failed){throw invalid("UNAVAILABLE");}
        });
    }
    @Scheduled(fixedDelay=60000,initialDelay=60000)
    public void cleanup(){
        java.util.List<String> candidates;
        try { candidates=objects.cleanupCandidates(); } catch(RuntimeException unavailable){return;}
        for(String key:candidates) {
            try {tx.executeWithoutResult(status->{
                if(!objects.claimCleanup(key) || objects.referenced(key)) return;
                try {storage.delete(key);}catch(IOException failed){return;} // Durable row retained for retry.
                objects.deleted(key);
            });}catch(RuntimeException retryLater){ /* Database contention/outage: retry next scan. */ }
        }
    }
    private static OrganizationMediaException invalid(String code){return new OrganizationMediaException("ORGANIZATION_MEDIA_"+code);}
}
