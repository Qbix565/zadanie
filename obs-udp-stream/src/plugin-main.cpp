#include <obs-module.h>
#include "udp-output.h"

OBS_DECLARE_MODULE()
OBS_MODULE_USE_DEFAULT_LOCALE("obs-udp-stream", "en-US")

bool obs_module_load(void)
{
    obs_register_source(&udp_stream_filter_info);
    return true;
}

void obs_module_unload(void)
{
}
