'use client'

import type { FC } from 'react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'
import BikeBrandWorkbench from '@/app/components/bike-brand'
import useDocumentTitle from '@/hooks/use-document-title'

const BikeBrandPage: FC = () => {
  const { t } = useTranslation('bikeBrand')
  useDocumentTitle(t('page.title'))

  return <BikeBrandWorkbench />
}

export default React.memo(BikeBrandPage)
