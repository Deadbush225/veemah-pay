package com.bank.controller;

import com.bank.repository.AccountRepository;
import com.bank.repository.TransactionRepository;
import com.bank.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private UserRepository userRepository;


    @DeleteMapping("/{accountNumber}")
    @Transactional
    public ResponseEntity<?> deleteAccount(@PathVariable String accountNumber) {
        if (!accountRepository.existsById(accountNumber)) {
            return ResponseEntity.notFound().build();
        }

        long txDeps = transactionRepository.countByAccountNumber(accountNumber) +
                transactionRepository.countByTargetAccount(accountNumber);
        long userDeps = userRepository.countByAccountNumber(accountNumber);
        if (txDeps > 0 || userDeps > 0) {
            String msg = String.format("Cannot delete account; dependencies exist (transactions=%d, users=%d). Consider archiving.", txDeps, userDeps);
            return ResponseEntity.status(409).body(msg);
        }

        try {
            accountRepository.deleteById(accountNumber);
        } catch (DataIntegrityViolationException e) {
            return ResponseEntity.status(409).body("Delete failed due to database constraints. Consider archiving the account.");
        }
        return ResponseEntity.noContent().build();
    }
}