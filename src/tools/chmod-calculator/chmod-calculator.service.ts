import * as _ from 'es-toolkit/compat';
import type { GroupPermissions, Permissions, SpecialPermissions } from './chmod-calculator.types';

import { translate as t } from '@/plugins/i18n.plugin';

export {
  applyUmask,
  computeIcaclsGrants,
  computeUmaskRepresentation,
  isValidUmask,
  computeChmodOctalRepresentation,
  computeChmodSymbolicRepresentation,
  computePermissionsFromChmodOctalRepresentation,
  computePermissionsFromChmodSymbolicRepresentation,
};

function computeChmodOctalRepresentation({ permissions }: { permissions: Permissions }): string {
  const permissionValue = { read: 4, write: 2, execute: 1 };
  const specialPermissionValue = { setuid: 4, setgid: 2, stickybit: 1 };

  const getGroupPermissionValue = (permission: GroupPermissions) =>
    _.reduce(permission, (acc, isPermSet, key) => acc + (isPermSet ? _.get(permissionValue, key, 0) : 0), 0);
  const getSpecialPermissionValue = (permission: SpecialPermissions) => {
    const octalValue = _.reduce(
      permission,
      (acc, isPermSet, key) => acc + (isPermSet ? _.get(specialPermissionValue, key, 0) : 0),
      0,
    );
    return octalValue > 0 ? octalValue.toString() : '';
  };

  return [
    getSpecialPermissionValue(permissions.flags || { setuid: false, setgid: false, stickybit: false }),
    getGroupPermissionValue(permissions.owner),
    getGroupPermissionValue(permissions.group),
    getGroupPermissionValue(permissions.public),
  ].join('');
}

function computeChmodSymbolicRepresentation({ permissions }: { permissions: Permissions }): string {
  // The special bits share the execute column: lowercase when execute is also set (s, t),
  // uppercase when it isn't (S, T), which is how ls -l shows them.
  const getGroupPermissionValue = (permission: GroupPermissions, specialFlag: null | 's' | 't') => {
    const execute = specialFlag
      ? permission.execute
        ? specialFlag
        : specialFlag.toUpperCase()
      : permission.execute
        ? 'x'
        : '-';
    return `${permission.read ? 'r' : '-'}${permission.write ? 'w' : '-'}${execute}`;
  };

  return [
    getGroupPermissionValue(permissions.owner, permissions.flags?.setuid ? 's' : null),
    getGroupPermissionValue(permissions.group, permissions.flags?.setgid ? 's' : null),
    getGroupPermissionValue(permissions.public, permissions.flags?.stickybit ? 't' : null),
  ].join('');
}

function computePermissionsFromChmodOctalRepresentation(octalPermissions: string): Permissions {
  const permissionValue = { read: 4, write: 2, execute: 1 };
  const specialPermissionValue = { setuid: 4, setgid: 2, stickybit: 1 };

  if (!octalPermissions || !octalPermissions.match(/^[0-7]{3,4}$/)) {
    throw new Error(
      t('tools.chmod-calculator.service.text.invalid-octal-permissions-must-be-3-or-4-octal-digits-octalpermissions', [
        octalPermissions,
      ]),
    );
  }
  const fullOctalPermissions = octalPermissions.length === 3 ? `0${octalPermissions}` : octalPermissions;

  const hasSet = (position: number, flagValue: number) =>
    (Number(fullOctalPermissions[position]) & flagValue) === flagValue;
  function computePermissionObject<T>(permissionSet: object, position: number): T {
    return _.reduce(permissionSet, (acc, flag, key) => ({ ...acc, [key]: hasSet(position, flag) }), {}) as T;
  }
  const flagsPosition = 0;
  const ownerPosition = 1;
  const groupPosition = 2;
  const publicPosition = 3;
  return {
    owner: computePermissionObject(permissionValue, ownerPosition),
    group: computePermissionObject(permissionValue, groupPosition),
    public: computePermissionObject(permissionValue, publicPosition),
    flags: computePermissionObject(specialPermissionValue, flagsPosition),
  };
}

function computePermissionsFromChmodSymbolicRepresentation(symbolicPermissions: string): Permissions {
  const formatRegex = /^[-dlbcsp]?([r-])([w-])([xsS-])([r-])([w-])([xsS-])([r-])([w-])([xtT-])$/;
  if (!symbolicPermissions || !symbolicPermissions.match(formatRegex)) {
    throw new Error(
      t(
        'tools.chmod-calculator.service.text.invalid-string-permissions-must-be-in-form-rwxrwxrwx-symbolicpermissions',
        [symbolicPermissions],
      ),
    );
  }

  const [_, rOwner, wOwner, xOwner, rGroup, wGroup, xGroup, rAll, wAll, xAll] =
    formatRegex.exec(symbolicPermissions) || [];
  const getOctal = (flag: string, flagLetter: string, flagValue: number) => (flag === flagLetter ? flagValue : 0);
  const owner =
    getOctal(rOwner, 'r', 4) + getOctal(wOwner, 'w', 2) + getOctal(xOwner, 'x', 1) + getOctal(xOwner, 's', 1);
  const groups =
    getOctal(rGroup, 'r', 4) + getOctal(wGroup, 'w', 2) + getOctal(xGroup, 'x', 1) + getOctal(xGroup, 's', 1);
  const all = getOctal(rAll, 'r', 4) + getOctal(wAll, 'w', 2) + getOctal(xAll, 'x', 1) + getOctal(xAll, 't', 1);
  const flags =
    getOctal(xOwner.toLowerCase(), 's', 4) +
    getOctal(xGroup.toLowerCase(), 's', 2) +
    getOctal(xAll.toLowerCase(), 't', 1);
  const octalString = `${flags > 0 ? flags : ''}${owner}${groups}${all}`;

  return computePermissionsFromChmodOctalRepresentation(octalString);
}

function computeUmaskRepresentation({ permissions }: { permissions: Permissions }): {
  octal: string;
  symbolic: string;
} {
  const permissionValue = { read: 'r', write: 'w', execute: 'x' };
  const getGroupPermissionValue = (permission: GroupPermissions) =>
    _.reduce(permission, (acc, isPermSet, key) => acc + (isPermSet ? _.get(permissionValue, key, '') : ''), '');

  const symbolic = `umask u=${getGroupPermissionValue(permissions.owner)},g=${getGroupPermissionValue(permissions.group)},o=${getGroupPermissionValue(permissions.public)}`;
  const octal = (
    0o777 -
    Number.parseInt(
      computeChmodOctalRepresentation({
        permissions: {
          owner: permissions.owner,
          group: permissions.group,
          public: permissions.public,
          flags: { setuid: false, setgid: false, stickybit: false },
        },
      }),
      8,
    )
  )
    .toString(8)
    .padStart(3, '0');

  return {
    symbolic,
    octal,
  };
}

function isValidUmask(umask: string): boolean {
  return /^0?[0-7]{3}$/.test(umask.trim());
}

// New files start from 666 (rw for everyone) and new directories from 777; the umask lists
// the bits to take away. Programs can ask for less (an SSH key is created 600 whatever the umask).
function applyUmask(umask: string): { file: string; directory: string } {
  const mask = Number.parseInt(umask.trim(), 8);
  const toOctal = (mode: number) => mode.toString(8).padStart(3, '0');
  return {
    file: toOctal(0o666 & ~mask),
    directory: toOctal(0o777 & ~mask),
  };
}

// Windows has no mode bits: NTFS uses access control lists. The closest icacls rights for
// each class. Write without delete on Windows is (W); rwx maps to Modify (M), which adds delete.
function computeIcaclsGrants({ permissions }: { permissions: Permissions }): {
  owner: string | null;
  group: string | null;
  public: string | null;
} {
  const toRights = (permission: GroupPermissions): string | null => {
    const { read, write, execute } = permission;
    if (read && write && execute) {
      return 'M';
    }
    if (read && execute) {
      return 'RX';
    }
    const rights = [read ? 'R' : '', write ? 'W' : '', execute ? 'X' : ''].filter(Boolean);
    return rights.length > 0 ? `(${rights.join(',')})` : null;
  };
  return {
    owner: toRights(permissions.owner),
    group: toRights(permissions.group),
    public: toRights(permissions.public),
  };
}
