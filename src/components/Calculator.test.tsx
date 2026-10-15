import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createFakeServices } from '@/test/fakeServices';
import { DraftProvider } from '@/state/draft';
import { ServicesProvider } from '@/state/services';
import { Calculator } from './Calculator';

function renderCalc() {
  return render(
    <ServicesProvider services={createFakeServices()}>
      <DraftProvider>
        <MemoryRouter>
          <Calculator />
        </MemoryRouter>
      </DraftProvider>
    </ServicesProvider>,
  );
}

describe('<Calculator />', () => {
  it('shows an itemized quote and enables Continue', async () => {
    renderCalc();
    expect(await screen.findByText('Exchange rate')).toBeInTheDocument();
    expect(screen.queryByText('Exchange spread')).not.toBeInTheDocument();
    expect(screen.getByText('Exchange fee')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Continue/ })).toBeEnabled();
  });

  it('switches network options with the asset and validates the amount', async () => {
    const user = userEvent.setup();
    renderCalc();
    await user.click(screen.getByLabelText('Asset'));
    await user.click(screen.getByRole('option', { name: /USDC/ }));
    await user.click(screen.getByLabelText('Network'));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      expect.stringMatching(/^Ethereum/),
      expect.stringMatching(/^Solana/),
      expect.stringMatching(/^Base/),
    ]);
    await user.keyboard('{Escape}');
    const amount = screen.getByLabelText('Amount to sell');
    await user.clear(amount);
    await user.type(amount, '1.234');
    expect(await screen.findByText(/at most 2 decimal places/)).toBeInTheDocument();
    expect(amount).toHaveAttribute('aria-invalid', 'true');
  });

  it('offers cash by courier as a payout option', async () => {
    const user = userEvent.setup();
    renderCalc();
    await user.click(screen.getByLabelText('Receive by'));
    const option = screen.getByRole('option', { name: /^Cash by courier/ });
    expect(option).not.toHaveAttribute('aria-disabled', 'true');
  });
});
