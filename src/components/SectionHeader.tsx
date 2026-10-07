import React from 'react';
import { Row } from './Stack';
import { Text } from './Text';

export interface SectionHeaderProps {
  /** Short overline, e.g. "Buttons" */
  title: string;
  /** Optional trailing control (e.g. a tertiary button) */
  action?: React.ReactNode;
}

/**
 * Overline section header. Prefers typography over cards: sections are
 * separated by spacing and this small tracked-out label, not boxes.
 */
export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <Row justify="between" align="center">
      <Text
        variant="metadata"
        color="muted"
        style={{ textTransform: 'uppercase' }}
      >
        {title}
      </Text>
      {action}
    </Row>
  );
}
