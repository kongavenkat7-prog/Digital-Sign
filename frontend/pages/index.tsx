import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '@/styles/Dashboard.module.css';

const HomePage: React.FC = () => {
  const router = useRouter();

  const workflows = [
    { step: 1, title: 'Upload PDF', description: 'Start by uploading your PDF document', icon: '📄' },
    { step: 2, title: 'Preview', description: 'Review your document before signing', icon: '👁️' },
    { step: 3, title: 'Sign', description: 'Create and place your digital signature', icon: '✍️' },
    { step: 4, title: 'Verify', description: 'Verify the audit trail and sign', icon: '✓' },
    { step: 5, title: 'Audit', description: 'View complete audit trail', icon: '📋' },
    { step: 6, title: 'Download', description: 'Download your signed PDF', icon: '⬇️' },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🔐</span>
            <h1>DigiSign</h1>
          </div>
          <p className={styles.tagline}>Digital Signature Solution</p>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroContent}>
            <h2>Sign Your Documents Digitally</h2>
            <p>Secure, verified, and auditable digital signatures</p>
            <button className={styles.ctaButton} onClick={() => router.push('/upload')}>
              Start Signing Now →
            </button>
          </div>
        </section>

        <section className={styles.workflowSection}>
          <h2>How It Works</h2>
          <div className={styles.workflowGrid}>
            {workflows.map((w) => (
              <div key={w.step} className={styles.workflowCard}>
                <div className={styles.workflowIcon}>{w.icon}</div>
                <h3>{w.title}</h3>
                <p>{w.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.featuresSection}>
          <h2>Why DigiSign?</h2>
          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🔒</div>
              <h3>Secure</h3>
              <p>End-to-end encrypted with SHA-256</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📊</div>
              <h3>Auditable</h3>
              <p>Complete audit trail with verification</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>⚡</div>
              <h3>Fast</h3>
              <p>Sign documents in seconds</p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>☁️</div>
              <h3>Cloud-Based</h3>
              <p>Access anywhere, anytime</p>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>&copy; 2024 DigiSign. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default HomePage;
