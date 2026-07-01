import * as D from '../infra/master';
import { addAlias, norm } from '../domain/match';
import { insertMatchAlias } from '../infra/db';
import { Session } from '../shared/types';

type TypedSessionKey =
  | 'typedStore'
  | 'typedBrand'
  | 'typedVariant'
  | 'typedSubCategory'
  | 'typedCompany'
  | 'typedReportSubtype';

function learnAlias(s: Session, typedKey: TypedSessionKey, kind: string, canonical: string): void {
  const rawVal = s[typedKey]?.trim();
  s[typedKey] = undefined;
  if (!rawVal || norm(rawVal) === norm(canonical)) return;
  insertMatchAlias(kind, rawVal, canonical, 'user-correction');
  addAlias(rawVal, canonical, kind);
  D.aliasRows.push({ kind, alias: rawVal, canonical });
}

export function registerLearnedAlias(s: Session, account: string): void {
  learnAlias(s, 'typedStore', 'store', account);
}

export function registerLearnedBranchAlias(s: Session, branch: string): void {
  learnAlias(s, 'typedStore', 'location', branch);
}

export function registerLearnedBrandAlias(s: Session, brand: string): void {
  learnAlias(s, 'typedBrand', 'brand', brand);
}

export function registerLearnedVariantAlias(s: Session, variant: string): void {
  learnAlias(s, 'typedVariant', 'variant_cluster', variant);
}

export function registerLearnedSubCategoryAlias(s: Session, subCat: string): void {
  learnAlias(s, 'typedSubCategory', 'subcat_keyword', subCat);
}

export function registerLearnedCompanyAlias(s: Session, company: string): void {
  learnAlias(s, 'typedCompany', 'company', company);
}

export function registerLearnedReportSubtypeAlias(s: Session, subtype: string): void {
  learnAlias(s, 'typedReportSubtype', 'subtype', subtype);
}
