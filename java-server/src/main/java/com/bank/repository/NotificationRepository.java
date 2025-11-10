package com.bank.repository;

import com.bank.model.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    Page<Notification> findByRecipientUserId(Long recipientUserId, Pageable pageable);
    Page<Notification> findByRecipientUserIdAndStatus(Long recipientUserId, String status, Pageable pageable);

    @Query("SELECT n FROM Notification n WHERE n.recipientUserId = :recipientId AND (LOWER(n.title) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(n.body) LIKE LOWER(CONCAT('%', :q, '%')))")
    Page<Notification> searchByRecipientAndQuery(@Param("recipientId") Long recipientId, @Param("q") String q, Pageable pageable);

    @Query("SELECT n FROM Notification n WHERE n.recipientUserId = :recipientId AND n.status = :status AND (LOWER(n.title) LIKE LOWER(CONCAT('%', :q, '%')) OR LOWER(n.body) LIKE LOWER(CONCAT('%', :q, '%')))")
    Page<Notification> searchByRecipientStatusAndQuery(@Param("recipientId") Long recipientId, @Param("status") String status, @Param("q") String q, Pageable pageable);

    long countByRecipientAccountNumber(String recipientAccountNumber);
}