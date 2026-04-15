import { createFileRoute } from '@tanstack/react-router'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Separator } from '../components/ui/separator'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <div className="page-wrap">
      <Card className="panel-surface">
        <CardHeader className="space-y-3">
          <Badge className="w-fit" variant="secondary">
            Overview
          </Badge>
          <CardTitle className="text-2xl">About the Viewer</CardTitle>
          <CardDescription className="max-w-3xl text-sm leading-6">
            This viewer previews MaterialX documents with the <code>@materialx-js/materialx-three</code> compiler and a
            live Three.js rendering viewport.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p className="m-0">
            Use it to load built-in examples, import your own <code>.mtlx</code> bundles with related textures, and
            inspect diagnostics while iterating on material graphs.
          </p>
          <Separator />
          <p className="m-0">
            The redesigned interface emphasizes a documentation-style layout, neutral color palette, and composable UI
            primitives while preserving all existing runtime and compilation behavior.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
