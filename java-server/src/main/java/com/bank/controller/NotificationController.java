package com.bank.controller;

import com.bank.controller.dto.CreateNotificationRequest;
import com.bank.controller.dto.UpdateNotificationRequest;
import com.bank.model.Notification;
import com.bank.repository.NotificationRepository;
import com.bank.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.Optional;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@Valid @RequestBody CreateNotificationRequest req) {
        if (!req.getType().equals("MESSAGE") && !req.getType().equals("ALERT")) {
            return ResponseEntity.badRequest().body("type must be MESSAGE or ALERT");
        }
        if (!userRepository.existsById(req.getRecipientUserId())) {
            return ResponseEntity.badRequest().body("invalid recipientUserId");
        }
        Notification n = new Notification();
        n.setType(req.getType());
        n.setTitle(req.getTitle());
        n.setBody(req.getBody());
        n.setRecipientUserId(req.getRecipientUserId());
        n.setRecipientAccountNumber(req.getRecipientAccountNumber());
        n.setSenderUserId(req.getSenderUserId());
        if (Boolean.TRUE.equals(req.getPinned())) n.setPinned(true);
        n.setStatus("UNREAD");
        n.setCreatedAt(OffsetDateTime.now());
        n.setUpdatedAt(OffsetDateTime.now());
        Notification saved = notificationRepository.save(n);
        return ResponseEntity.created(URI.create("/api/notifications/" + saved.getId())).body(saved);
    }

    @GetMapping
    public ResponseEntity<Page<Notification>> list(
            @RequestParam Long recipientId,
            @RequestParam(required = false, defaultValue = "false") boolean unreadOnly,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        PageRequest pr = PageRequest.of(page, size);
        Page<Notification> result;
        if (unreadOnly) {
            if (q != null && !q.isBlank()) {
                result = notificationRepository.searchByRecipientStatusAndQuery(recipientId, "UNREAD", q, pr);
            } else {
                result = notificationRepository.findByRecipientUserIdAndStatus(recipientId, "UNREAD", pr);
            }
        } else {
            if (q != null && !q.isBlank()) {
                result = notificationRepository.searchByRecipientAndQuery(recipientId, q, pr);
            } else {
                result = notificationRepository.findByRecipientUserId(recipientId, pr);
            }
        }
        return ResponseEntity.ok(result);
    }

    @PatchMapping("/{id}")
    @Transactional
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody UpdateNotificationRequest req) {
        Optional<Notification> opt = notificationRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        Notification n = opt.get();
        boolean statusChangedToRead = false;
        if (req.getTitle() != null) n.setTitle(req.getTitle());
        if (req.getBody() != null) n.setBody(req.getBody());
        if (req.getPinned() != null) n.setPinned(Boolean.TRUE.equals(req.getPinned()));
        if (req.getStatus() != null) {
            if (!req.getStatus().equals("UNREAD") && !req.getStatus().equals("READ")) {
                return ResponseEntity.badRequest().body("status must be UNREAD or READ");
            }
            statusChangedToRead = !"READ".equals(n.getStatus()) && "READ".equals(req.getStatus());
            n.setStatus(req.getStatus());
        }
        if (statusChangedToRead) {
            n.setReadAt(OffsetDateTime.now());
        }
        n.setUpdatedAt(OffsetDateTime.now());
        Notification saved = notificationRepository.save(n);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/{id}/mark-read")
    @Transactional
    public ResponseEntity<?> markRead(@PathVariable Long id) {
        Optional<Notification> opt = notificationRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        Notification n = opt.get();
        n.setStatus("READ");
        if (n.getReadAt() == null) n.setReadAt(OffsetDateTime.now());
        n.setUpdatedAt(OffsetDateTime.now());
        Notification saved = notificationRepository.save(n);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> delete(@PathVariable Long id) {
        if (!notificationRepository.existsById(id)) return ResponseEntity.notFound().build();
        notificationRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}