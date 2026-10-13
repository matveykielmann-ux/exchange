import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createMockServices } from '@/services/mock';
import { DraftProvider } from '@/state/draft';
import { ServicesProvider } from '@/state/services';
import { Calculator } from './Calculator';

function renderCalc() {
  return render(
    <ServicesProvider services={createMockServices({ latencyMs: 0 })}>
      <DraftProvider>
        <MemoryRouter>
          <Calculator />
        </MemoryRouter>
      </DraftProvider>
    </ServicesProvider>,
  );
}

describe('<Calculator />', () => {
  it('shows an itemized, mock-labelled quote and enables Continue', async () => {
    renderCalc();
    expect(screen.getByText('Mock pricing')).toBeInTheDocument();
    expect(await screen.findByText('Exchange spread')).toBeInTheDocument();
    expect(screen.getByText('Payout fee')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Continue/ })).toBeEnabled();
  });

  it('switches network options with the asset and validates the amount', async () => {
    const user = userEvent.setup();
    renderCalc();
    await user.selectOptions(screen.getByLabelText('Asset'), 'USDC');
    const network = screen.getByLabelText('Network');
    expect([...(network as HTMLSelectElement).options].map((o) => o.value)).toEqual(['ethereum', 'solana', 'base']);
    const amount = screen.getByLabelText('Amount to sell');
    await user.clear(amount);
    await user.type(amount, '1.234');
    expect(await screen.findByText(/at most 2 decimal places/)).toBeInTheDocument();
    expect(amount).toHaveAttribute('aria-invalid', 'true');
  });

  it('lists cash by courier as not offered', () => {
    renderCalc();
    const option = screen.getByRole('option', { name: /Cash by courier — not offered/ });
    expect(option).toBeDisabled();
  });
});
