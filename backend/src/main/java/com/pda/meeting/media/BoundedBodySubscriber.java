package com.pda.meeting.media;

import java.io.ByteArrayOutputStream;
import java.net.http.HttpResponse;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Flow;

final class BoundedBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {
    private final int limit;
    private final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    private final CompletableFuture<byte[]> result = new CompletableFuture<>();
    private Flow.Subscription subscription;
    BoundedBodySubscriber(int limit) { this.limit = limit; }
    @Override public CompletionStage<byte[]> getBody() { return result; }
    @Override public void onSubscribe(Flow.Subscription value) { subscription = value; value.request(1); }
    @Override public void onNext(List<ByteBuffer> buffers) {
        for (ByteBuffer buffer : buffers) {
            if (buffer.remaining() > limit - bytes.size()) {
                subscription.cancel(); result.completeExceptionally(new IllegalStateException("Media response too large")); return;
            }
            byte[] part = new byte[buffer.remaining()]; buffer.get(part); bytes.writeBytes(part);
        }
        subscription.request(1);
    }
    @Override public void onError(Throwable error) { result.completeExceptionally(new IllegalStateException("Media response failed")); }
    @Override public void onComplete() { result.complete(bytes.toByteArray()); }
}
