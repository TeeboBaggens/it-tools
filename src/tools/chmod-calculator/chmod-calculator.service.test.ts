import { describe, expect, it } from 'vitest';
import {
  applyUmask,
  computeIcaclsGrants,
  isValidUmask,
  computeChmodOctalRepresentation,
  computeChmodSymbolicRepresentation,
  computePermissionsFromChmodOctalRepresentation,
  computePermissionsFromChmodSymbolicRepresentation,
  computeUmaskRepresentation,
} from './chmod-calculator.service';

describe('chmod-calculator', () => {
  describe('computeChmodOctalRepresentation', () => {
    it('get the octal representation from permissions', () => {
      expect(
        computeChmodOctalRepresentation({
          permissions: {
            owner: { read: true, write: true, execute: true },
            group: { read: true, write: true, execute: true },
            public: { read: true, write: true, execute: true },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.eql('777');

      expect(
        computeChmodOctalRepresentation({
          permissions: {
            owner: { read: false, write: false, execute: false },
            group: { read: false, write: false, execute: false },
            public: { read: false, write: false, execute: false },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.eql('000');

      expect(
        computeChmodOctalRepresentation({
          permissions: {
            owner: { read: false, write: true, execute: false },
            group: { read: false, write: true, execute: true },
            public: { read: true, write: false, execute: true },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.eql('235');

      expect(
        computeChmodOctalRepresentation({
          permissions: {
            owner: { read: true, write: false, execute: false },
            group: { read: false, write: true, execute: false },
            public: { read: false, write: false, execute: true },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.eql('421');

      expect(
        computeChmodOctalRepresentation({
          permissions: {
            owner: { read: false, write: false, execute: true },
            group: { read: false, write: true, execute: false },
            public: { read: true, write: false, execute: false },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.eql('124');

      expect(
        computeChmodOctalRepresentation({
          permissions: {
            owner: { read: false, write: true, execute: false },
            group: { read: false, write: true, execute: false },
            public: { read: false, write: true, execute: false },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.eql('222');

      expect(
        computeChmodOctalRepresentation({
          permissions: {
            owner: { read: false, write: true, execute: false },
            group: { read: false, write: true, execute: false },
            public: { read: false, write: true, execute: false },
            flags: { setuid: true, setgid: true, stickybit: true },
          },
        }),
      ).to.eql('7222');

      expect(
        computeChmodOctalRepresentation({
          permissions: {
            owner: { read: false, write: true, execute: false },
            group: { read: false, write: true, execute: false },
            public: { read: false, write: true, execute: false },
            flags: { setuid: true, setgid: false, stickybit: false },
          },
        }),
      ).to.eql('4222');

      expect(
        computeChmodOctalRepresentation({
          permissions: {
            owner: { read: false, write: true, execute: false },
            group: { read: false, write: true, execute: false },
            public: { read: false, write: true, execute: false },
            flags: { setuid: false, setgid: true, stickybit: false },
          },
        }),
      ).to.eql('2222');

      expect(
        computeChmodOctalRepresentation({
          permissions: {
            owner: { read: false, write: true, execute: false },
            group: { read: false, write: true, execute: false },
            public: { read: false, write: true, execute: false },
            flags: { setuid: false, setgid: false, stickybit: true },
          },
        }),
      ).to.eql('1222');
    });
  });
  describe('computeChmodSymbolicRepresentation', () => {
    it('get the symbolic representation from permissions', () => {
      expect(
        computeChmodSymbolicRepresentation({
          permissions: {
            owner: { read: true, write: true, execute: true },
            group: { read: true, write: true, execute: true },
            public: { read: true, write: true, execute: true },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.eql('rwxrwxrwx');

      expect(
        computeChmodSymbolicRepresentation({
          permissions: {
            owner: { read: false, write: false, execute: false },
            group: { read: false, write: false, execute: false },
            public: { read: false, write: false, execute: false },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.eql('---------');

      expect(
        computeChmodSymbolicRepresentation({
          permissions: {
            owner: { read: false, write: true, execute: false },
            group: { read: false, write: true, execute: true },
            public: { read: true, write: false, execute: true },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.eql('-w--wxr-x');

      expect(
        computeChmodSymbolicRepresentation({
          permissions: {
            owner: { read: true, write: false, execute: false },
            group: { read: false, write: true, execute: false },
            public: { read: false, write: false, execute: true },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.eql('r---w---x');

      expect(
        computeChmodSymbolicRepresentation({
          permissions: {
            owner: { read: false, write: false, execute: true },
            group: { read: false, write: true, execute: false },
            public: { read: true, write: false, execute: false },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.eql('--x-w-r--');

      expect(
        computeChmodSymbolicRepresentation({
          permissions: {
            owner: { read: false, write: true, execute: false },
            group: { read: false, write: true, execute: false },
            public: { read: false, write: true, execute: false },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.eql('-w--w--w-');

      expect(
        computeChmodSymbolicRepresentation({
          permissions: {
            owner: { read: false, write: false, execute: true },
            group: { read: false, write: true, execute: false },
            public: { read: true, write: false, execute: false },
            flags: { setuid: false, setgid: false, stickybit: true },
          },
        }),
      ).to.eql('--x-w-r-T');

      expect(
        computeChmodSymbolicRepresentation({
          permissions: {
            owner: { read: false, write: false, execute: true },
            group: { read: false, write: true, execute: false },
            public: { read: true, write: false, execute: false },
            flags: { setuid: false, setgid: true, stickybit: true },
          },
        }),
      ).to.eql('--x-wSr-T');

      expect(
        computeChmodSymbolicRepresentation({
          permissions: {
            owner: { read: false, write: false, execute: true },
            group: { read: false, write: true, execute: false },
            public: { read: true, write: false, execute: false },
            flags: { setuid: true, setgid: true, stickybit: true },
          },
        }),
      ).to.eql('--s-wSr-T');

      expect(
        computeChmodSymbolicRepresentation({
          permissions: {
            owner: { read: true, write: false, execute: true },
            group: { read: true, write: true, execute: false },
            public: { read: true, write: false, execute: false },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.eql('r-xrw-r--');

      expect(
        computeChmodSymbolicRepresentation({
          permissions: {
            owner: { read: true, write: true, execute: true },
            group: { read: true, write: true, execute: true },
            public: { read: true, write: true, execute: true },
            flags: { setuid: true, setgid: true, stickybit: true },
          },
        }),
      ).to.eql('rwsrwsrwt');
    });
  });
  describe('computePermissionsFromChmodOctalRepresentation', () => {
    it('throws on invalid octal values', () => {
      expect(() => computePermissionsFromChmodOctalRepresentation('12')).to.throw();
      expect(() => computePermissionsFromChmodOctalRepresentation('12345')).to.throw();
      expect(() => computePermissionsFromChmodOctalRepresentation('999')).to.throw();
      expect(() => computePermissionsFromChmodOctalRepresentation('9999')).to.throw();
    });

    it('get permissions from octal representation', () => {
      expect(computePermissionsFromChmodOctalRepresentation('777')).to.eql({
        owner: { read: true, write: true, execute: true },
        group: { read: true, write: true, execute: true },
        public: { read: true, write: true, execute: true },
        flags: { setuid: false, setgid: false, stickybit: false },
      });

      expect(computePermissionsFromChmodOctalRepresentation('000')).to.eql({
        owner: { read: false, write: false, execute: false },
        group: { read: false, write: false, execute: false },
        public: { read: false, write: false, execute: false },
        flags: { setuid: false, setgid: false, stickybit: false },
      });

      expect(computePermissionsFromChmodOctalRepresentation('235')).to.eql({
        owner: { read: false, write: true, execute: false },
        group: { read: false, write: true, execute: true },
        public: { read: true, write: false, execute: true },
        flags: { setuid: false, setgid: false, stickybit: false },
      });

      expect(computePermissionsFromChmodOctalRepresentation('421')).to.eql({
        owner: { read: true, write: false, execute: false },
        group: { read: false, write: true, execute: false },
        public: { read: false, write: false, execute: true },
        flags: { setuid: false, setgid: false, stickybit: false },
      });

      expect(computePermissionsFromChmodOctalRepresentation('124')).to.eql({
        owner: { read: false, write: false, execute: true },
        group: { read: false, write: true, execute: false },
        public: { read: true, write: false, execute: false },
        flags: { setuid: false, setgid: false, stickybit: false },
      });

      expect(computePermissionsFromChmodOctalRepresentation('222')).to.eql({
        owner: { read: false, write: true, execute: false },
        group: { read: false, write: true, execute: false },
        public: { read: false, write: true, execute: false },
        flags: { setuid: false, setgid: false, stickybit: false },
      });

      expect(computePermissionsFromChmodOctalRepresentation('7222')).to.eql({
        owner: { read: false, write: true, execute: false },
        group: { read: false, write: true, execute: false },
        public: { read: false, write: true, execute: false },
        flags: { setuid: true, setgid: true, stickybit: true },
      });

      expect(computePermissionsFromChmodOctalRepresentation('4222')).to.eql({
        owner: { read: false, write: true, execute: false },
        group: { read: false, write: true, execute: false },
        public: { read: false, write: true, execute: false },
        flags: { setuid: true, setgid: false, stickybit: false },
      });

      expect(computePermissionsFromChmodOctalRepresentation('2222')).to.eql({
        owner: { read: false, write: true, execute: false },
        group: { read: false, write: true, execute: false },
        public: { read: false, write: true, execute: false },
        flags: { setuid: false, setgid: true, stickybit: false },
      });

      expect(computePermissionsFromChmodOctalRepresentation('1222')).to.eql({
        owner: { read: false, write: true, execute: false },
        group: { read: false, write: true, execute: false },
        public: { read: false, write: true, execute: false },
        flags: { setuid: false, setgid: false, stickybit: true },
      });
    });
  });
  describe('computePermissionsFromChmodSymbolicRepresentation', () => {
    it('throws on invalid symbolic values', () => {
      expect(() => computePermissionsFromChmodSymbolicRepresentation('rr---')).to.throw();
      expect(() => computePermissionsFromChmodSymbolicRepresentation('rwxrwx--w')).to.throw();
    });

    it('get permissions from symbolic representation', () => {
      expect(computePermissionsFromChmodSymbolicRepresentation('dr-xr-xr-x')).to.eql({
        owner: { read: true, write: false, execute: true },
        group: { read: true, write: false, execute: true },
        public: { read: true, write: false, execute: true },
        flags: { setuid: false, setgid: false, stickybit: false },
      });
      expect(computePermissionsFromChmodSymbolicRepresentation('-rw-r--r--')).to.eql({
        owner: { read: true, write: true, execute: false },
        group: { read: true, write: false, execute: false },
        public: { read: true, write: false, execute: false },
        flags: { setuid: false, setgid: false, stickybit: false },
      });

      expect(computePermissionsFromChmodSymbolicRepresentation('rwxrwxrwx')).to.eql({
        owner: { read: true, write: true, execute: true },
        group: { read: true, write: true, execute: true },
        public: { read: true, write: true, execute: true },
        flags: { setuid: false, setgid: false, stickybit: false },
      });

      expect(computePermissionsFromChmodSymbolicRepresentation('---------')).to.eql({
        owner: { read: false, write: false, execute: false },
        group: { read: false, write: false, execute: false },
        public: { read: false, write: false, execute: false },
        flags: { setuid: false, setgid: false, stickybit: false },
      });

      expect(computePermissionsFromChmodSymbolicRepresentation('r---wxr-x')).to.eql({
        owner: { read: true, write: false, execute: false },
        group: { read: false, write: true, execute: true },
        public: { read: true, write: false, execute: true },
        flags: { setuid: false, setgid: false, stickybit: false },
      });

      expect(computePermissionsFromChmodSymbolicRepresentation('r---w---x')).to.eql({
        owner: { read: true, write: false, execute: false },
        group: { read: false, write: true, execute: false },
        public: { read: false, write: false, execute: true },
        flags: { setuid: false, setgid: false, stickybit: false },
      });

      expect(computePermissionsFromChmodSymbolicRepresentation('--x-w-r--')).to.eql({
        owner: { read: false, write: false, execute: true },
        group: { read: false, write: true, execute: false },
        public: { read: true, write: false, execute: false },
        flags: { setuid: false, setgid: false, stickybit: false },
      });

      expect(computePermissionsFromChmodSymbolicRepresentation('-w--w--w-')).to.eql({
        owner: { read: false, write: true, execute: false },
        group: { read: false, write: true, execute: false },
        public: { read: false, write: true, execute: false },
        flags: { setuid: false, setgid: false, stickybit: false },
      });

      expect(computePermissionsFromChmodSymbolicRepresentation('-ws-ws-wt')).to.eql({
        owner: { read: false, write: true, execute: true },
        group: { read: false, write: true, execute: true },
        public: { read: false, write: true, execute: true },
        flags: { setuid: true, setgid: true, stickybit: true },
      });

      expect(computePermissionsFromChmodSymbolicRepresentation('-ws-w--w-')).to.eql({
        owner: { read: false, write: true, execute: true },
        group: { read: false, write: true, execute: false },
        public: { read: false, write: true, execute: false },
        flags: { setuid: true, setgid: false, stickybit: false },
      });

      expect(computePermissionsFromChmodSymbolicRepresentation('-w--ws-w-')).to.eql({
        owner: { read: false, write: true, execute: false },
        group: { read: false, write: true, execute: true },
        public: { read: false, write: true, execute: false },
        flags: { setuid: false, setgid: true, stickybit: false },
      });

      expect(computePermissionsFromChmodSymbolicRepresentation('-w--w--wt')).to.eql({
        owner: { read: false, write: true, execute: false },
        group: { read: false, write: true, execute: false },
        public: { read: false, write: true, execute: true },
        flags: { setuid: false, setgid: false, stickybit: true },
      });
    });
  });

  describe('computeUmaskRepresentation', () => {
    it('get the umask from permissions', () => {
      expect(
        computeUmaskRepresentation({
          permissions: {
            owner: { read: true, write: true, execute: true },
            group: { read: true, write: true, execute: true },
            public: { read: true, write: true, execute: true },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.deep.eq({
        octal: '000',
        symbolic: 'umask u=rwx,g=rwx,o=rwx',
      });

      expect(
        computeUmaskRepresentation({
          permissions: {
            owner: { read: false, write: false, execute: false },
            group: { read: false, write: false, execute: false },
            public: { read: false, write: false, execute: false },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.deep.eq({
        octal: '777',
        symbolic: 'umask u=,g=,o=',
      });

      expect(
        computeUmaskRepresentation({
          permissions: {
            owner: { read: false, write: true, execute: false },
            group: { read: false, write: true, execute: true },
            public: { read: true, write: false, execute: true },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.deep.eq({
        octal: '542',
        symbolic: 'umask u=w,g=wx,o=rx',
      });

      expect(
        computeUmaskRepresentation({
          permissions: {
            owner: { read: true, write: false, execute: false },
            group: { read: false, write: true, execute: false },
            public: { read: false, write: false, execute: true },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.deep.eq({
        octal: '356',
        symbolic: 'umask u=r,g=w,o=x',
      });

      expect(
        computeUmaskRepresentation({
          permissions: {
            owner: { read: false, write: false, execute: true },
            group: { read: false, write: true, execute: false },
            public: { read: true, write: false, execute: false },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.deep.eq({
        octal: '653',
        symbolic: 'umask u=x,g=w,o=r',
      });

      expect(
        computeUmaskRepresentation({
          permissions: {
            owner: { read: false, write: true, execute: false },
            group: { read: false, write: true, execute: false },
            public: { read: false, write: true, execute: false },
            flags: { setuid: false, setgid: false, stickybit: false },
          },
        }),
      ).to.deep.eq({
        octal: '555',
        symbolic: 'umask u=w,g=w,o=w',
      });

      expect(
        computeUmaskRepresentation({
          permissions: {
            owner: { read: false, write: false, execute: true },
            group: { read: false, write: true, execute: false },
            public: { read: true, write: false, execute: false },
            flags: { setuid: true, setgid: true, stickybit: true },
          },
        }),
      ).to.deep.eq({
        octal: '653',
        symbolic: 'umask u=x,g=w,o=r',
      });
    });
  });

  describe('symbolic special bits without execute', () => {
    it('parses uppercase S and T as the flag without execute', () => {
      expect(computePermissionsFromChmodSymbolicRepresentation('rwSr-Sr-T')).to.eql({
        owner: { read: true, write: true, execute: false },
        group: { read: true, write: false, execute: false },
        public: { read: true, write: false, execute: false },
        flags: { setuid: true, setgid: true, stickybit: true },
      });
    });
    it('round-trips through octal', () => {
      expect(
        computeChmodOctalRepresentation({
          permissions: computePermissionsFromChmodSymbolicRepresentation('drwxrwxrwt'),
        }),
      ).to.eql('1777');
      expect(
        computeChmodSymbolicRepresentation({ permissions: computePermissionsFromChmodOctalRepresentation('4644') }),
      ).to.eql('rwSr--r--');
      expect(
        computeChmodSymbolicRepresentation({ permissions: computePermissionsFromChmodOctalRepresentation('2775') }),
      ).to.eql('rwxrwsr-x');
    });
  });

  describe('umask', () => {
    it('validates 3 or 4 octal digits', () => {
      expect(isValidUmask('022')).to.eql(true);
      expect(isValidUmask('0027')).to.eql(true);
      expect(isValidUmask('22')).to.eql(false);
      expect(isValidUmask('089')).to.eql(false);
    });
    it('computes default file and directory modes', () => {
      expect(applyUmask('022')).to.eql({ file: '644', directory: '755' });
      expect(applyUmask('0027')).to.eql({ file: '640', directory: '750' });
      expect(applyUmask('077')).to.eql({ file: '600', directory: '700' });
      expect(applyUmask('002')).to.eql({ file: '664', directory: '775' });
    });
  });

  describe('computeIcaclsGrants', () => {
    it('maps each class to the nearest icacls rights', () => {
      expect(computeIcaclsGrants({ permissions: computePermissionsFromChmodOctalRepresentation('750') })).to.eql({
        owner: 'M',
        group: 'RX',
        public: null,
      });
      expect(computeIcaclsGrants({ permissions: computePermissionsFromChmodOctalRepresentation('642') })).to.eql({
        owner: '(R,W)',
        group: '(R)',
        public: '(W)',
      });
    });
  });
});
