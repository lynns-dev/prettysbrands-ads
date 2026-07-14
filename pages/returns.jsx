import React from 'react';
import PolicyLayout, { PolicySection } from '../components/PolicyLayout';

export default function ReturnPolicy() {
  return (
    <PolicyLayout title="Return Policy" updated="July 2026">
      <p>We want you to love what you ordered. If something's not right, here's how returns and exchanges work.</p>

      <PolicySection title="Return window">
        <p>
          Unopened, unused products can be returned within 30 days of delivery for a full refund to your original
          payment method.
        </p>
      </PolicySection>

      <PolicySection title="Opened products">
        <p>
          Because our products are cosmetics applied to skin, opened or used items are final sale and can't be
          returned for hygiene reasons — unless the product arrived damaged or defective, in which case see below.
        </p>
      </PolicySection>

      <PolicySection title="Damaged or defective items">
        <p>
          If your order arrives damaged or defective, email us at{' '}
          <a href="mailto:hello@smellsiconic.com" style={{ textDecoration: 'underline' }}>hello@smellsiconic.com</a> within 14
          days of delivery with your order number and a photo, and we'll send a replacement or refund at no cost to
          you.
        </p>
      </PolicySection>

      <PolicySection title="How to start a return">
        <p>
          Email <a href="mailto:hello@smellsiconic.com" style={{ textDecoration: 'underline' }}>hello@smellsiconic.com</a>{' '}
          with your order number and we'll send return instructions. Please don't send anything back before hearing
          from us.
        </p>
      </PolicySection>

      <PolicySection title="Refunds">
        <p>
          Once we receive and inspect your return, we'll process your refund to the original payment method.
          Depending on your bank or card issuer, it can take several business days for the refund to appear.
        </p>
      </PolicySection>

      <PolicySection title="Return shipping">
        <p>
          Return shipping is the customer's responsibility unless the return is due to our error (damaged, defective,
          or incorrect item).
        </p>
      </PolicySection>

      <PolicySection title="Exchanges">
        <p>
          Want a different scent instead? Follow the return process above for the original item and place a new
          order for the one you'd like.
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
