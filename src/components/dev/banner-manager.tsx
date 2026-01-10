'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, RefreshCw, Save } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'

interface BannerSettings {
  enabled: boolean
  text: string
  link: string
  backgroundColor: string
}

export function BannerManager() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<BannerSettings>({
    enabled: true,
    text: 'This website is still a work in progress! Please report any issues to teamysite@gmail.com',
    link: '',
    backgroundColor: '#8B5CF6',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/dev/site-settings?key=banner_enabled')
      const enabledData = await response.json()
      
      const textResponse = await fetch('/api/dev/site-settings?key=banner_text')
      const textData = await textResponse.json()
      
      const linkResponse = await fetch('/api/dev/site-settings?key=banner_link')
      const linkData = await linkResponse.json()
      
      const bgResponse = await fetch('/api/dev/site-settings?key=banner_background_color')
      const bgData = await bgResponse.json()

      setSettings({
        enabled: enabledData.setting?.value === 'true',
        text: textData.setting?.value || 'This website is still a work in progress! Please report any issues to teamysite@gmail.com',
        link: linkData.setting?.value || '',
        backgroundColor: bgData.setting?.value || '#8B5CF6',
      })
    } catch (error) {
      console.error('Failed to fetch banner settings:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Save all settings
      await Promise.all([
        fetch('/api/dev/site-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'banner_enabled', value: settings.enabled.toString() }),
        }),
        fetch('/api/dev/site-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'banner_text', value: settings.text }),
        }),
        fetch('/api/dev/site-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'banner_link', value: settings.link }),
        }),
        fetch('/api/dev/site-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'banner_background_color', value: settings.backgroundColor }),
        }),
      ])

      toast({
        title: 'Success',
        description: 'Banner settings saved successfully!',
      })
    } catch (error) {
      console.error('Failed to save banner settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to save banner settings',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Site Banner Settings</CardTitle>
            <CardDescription>
              Configure the site-wide banner displayed at the top of public pages
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchSettings} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Enable/Disable Banner */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="banner-enabled" className="text-base font-medium">
                  Enable Banner
                </Label>
                <p className="text-sm text-muted-foreground">
                  Show or hide the banner on public pages
                </p>
              </div>
              <Switch
                id="banner-enabled"
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
              />
            </div>

            {/* Banner Text */}
            <div className="space-y-2">
              <Label htmlFor="banner-text">Banner Text</Label>
              <Textarea
                id="banner-text"
                value={settings.text}
                onChange={(e) => setSettings({ ...settings, text: e.target.value })}
                placeholder="Enter banner message..."
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                This text will be displayed in the banner. Keep it concise and informative.
              </p>
            </div>

            {/* Banner Link */}
            <div className="space-y-2">
              <Label htmlFor="banner-link">Banner Link (Optional)</Label>
              <Input
                id="banner-link"
                type="url"
                value={settings.link}
                onChange={(e) => setSettings({ ...settings, link: e.target.value })}
                placeholder="https://example.com"
              />
              <p className="text-xs text-muted-foreground">
                If provided, the banner text will be clickable and link to this URL.
              </p>
            </div>

            {/* Background Color */}
            <div className="space-y-2">
              <Label htmlFor="banner-bg">Background Color</Label>
              <div className="flex gap-2">
                <Input
                  id="banner-bg"
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                  className="w-20 h-10 cursor-pointer"
                />
                <Input
                  type="text"
                  value={settings.backgroundColor}
                  onChange={(e) => setSettings({ ...settings, backgroundColor: e.target.value })}
                  placeholder="#5865F2"
                  className="flex-1"
                />
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div 
                className="py-2 px-4 text-center text-sm text-white rounded-lg"
                style={{ backgroundColor: settings.backgroundColor }}
              >
                {settings.enabled ? settings.text : '(Banner is disabled)'}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

